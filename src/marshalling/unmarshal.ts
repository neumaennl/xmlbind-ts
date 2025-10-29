import { XMLParser } from "fast-xml-parser";
import {
  getMeta,
  ensureMeta,
  getAllFields,
} from "../metadata/MetadataRegistry";
import { castValue } from "../util/valueCasting";
import {
  ParsedXmlNode,
  ParsedXmlValue,
  PrimitiveConstructor,
  isParsedXmlNode,
} from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
});

function isPrimitiveCtor(fn: unknown): fn is PrimitiveConstructor {
  return fn === String || fn === Number || fn === Boolean || fn === Date;
}

type NsMap = { [prefix: string]: string };

function collectNs(node: ParsedXmlNode, parent: NsMap | undefined): NsMap {
  const map: NsMap = parent ? { ...parent } : {};
  for (const k of Object.keys(node)) {
    if (!k.startsWith("@_")) continue;
    const name = k.substring(2);
    if (name === "xmlns") {
      map[""] = String((node as any)[k]);
    } else if (name.startsWith("xmlns:")) {
      const pfx = name.substring("xmlns:".length);
      map[pfx] = String((node as any)[k]);
    }
  }
  return map;
}

function matchElementKey(
  node: ParsedXmlNode,
  local: string,
  ns: string | undefined,
  nsMap: NsMap
): string | undefined {
  // try direct match first
  if (node[local] !== undefined && ns === undefined) return local;
  // otherwise scan keys and match by local name and namespace
  for (const key of Object.keys(node)) {
    if (key.startsWith("@_") || key === "#text") continue;
    const idx = key.indexOf(":");
    const kLocal = idx >= 0 ? key.substring(idx + 1) : key;
    if (kLocal !== local) continue;
    const prefix = idx >= 0 ? key.substring(0, idx) : "";
    const uri = prefix ? nsMap[prefix] : nsMap[""];
    if (ns === undefined || uri === ns) return key;
  }
  return undefined;
}

function matchAttributeKey(
  node: ParsedXmlNode,
  local: string,
  ns: string | undefined,
  nsMap: NsMap
): string | undefined {
  // Attributes with namespace must be prefixed; default namespace doesn't apply to attributes
  if (ns === undefined) {
    const k = "@_" + local;
    if ((node as any)[k] !== undefined) return k;
  } else {
    for (const key of Object.keys(node)) {
      if (!key.startsWith("@_")) continue;
      const name = key.substring(2);
      const idx = name.indexOf(":");
      if (idx < 0) continue; // unprefixed attribute: no namespace
      const pfx = name.substring(0, idx);
      const kLocal = name.substring(idx + 1);
      if (kLocal !== local) continue;
      const uri = nsMap[pfx];
      if (uri === ns) return key;
    }
  }
  return undefined;
}

function xmlValueToObject<T>(
  node: ParsedXmlValue,
  cls: new () => T,
  nsMap: NsMap
): T {
  if (isPrimitiveCtor(cls)) {
    // node may be a primitive value or an object with a text node
    if (isParsedXmlNode(node)) {
      if (node["#text"] !== undefined) return castValue(node["#text"], cls);
      return castValue(node, cls);
    }
    return castValue(node, cls);
  }

  const inst = new cls();
  ensureMeta(cls);
  if (!isParsedXmlNode(node)) return inst;

  const target = inst as Record<string, unknown>;
  const hereNs = collectNs(node, nsMap);

  const fields = getAllFields(cls);
  for (const f of fields) {
    if (f.kind === "attribute") {
      const k = matchAttributeKey(
        node,
        f.name || f.key,
        f.namespace ?? undefined,
        hereNs
      );
      if (k && (node as any)[k] !== undefined) {
        target[f.key] = castValue((node as any)[k], f.type);
      }
    } else if (f.kind === "element") {
      const k = matchElementKey(
        node,
        f.name || f.key,
        f.namespace ?? undefined,
        hereNs
      );
      if (k && (node as any)[k] !== undefined) {
        const val = (node as any)[k];
        if (Array.isArray(val)) {
          target[f.key] = val.map((v) => xmlValueToObject(v, f.type, hereNs));
        } else if (isParsedXmlNode(val) && val["@_xsi:nil"] === "true") {
          target[f.key] = null;
        } else {
          target[f.key] = xmlValueToObject(val, f.type, hereNs);
        }
      }
    }
  }

  const textField = fields.find((f) => f.kind === "text");
  if (textField && node["#text"] !== undefined) {
    target[textField.key] = castValue(node["#text"], textField.type);
  }

  return inst;
}

export function unmarshal<T>(cls: new () => T, xml: string): T {
  const parsed = parser.parse(xml) as ParsedXmlNode;
  const meta = getMeta(cls);
  if (!meta) throw new Error("No XmlRoot metadata for " + cls.name);
  const rootName = meta.rootName ?? cls.name;
  // root may be prefixed; find by local name
  let node: ParsedXmlValue | undefined = (parsed as any)[rootName];
  if (!isParsedXmlNode(node)) {
    // try to find a key with localName == rootName
    for (const key of Object.keys(parsed)) {
      const idx = key.indexOf(":");
      const local = idx >= 0 ? key.substring(idx + 1) : key;
      if (local === rootName) {
        node = (parsed as any)[key];
        break;
      }
    }
  }

  // Handle simple text values (when node is a primitive)
  if (node !== undefined && !isParsedXmlNode(node)) {
    const inst = new cls();
    const fields = getAllFields(cls);
    const textField = fields.find((f) => f.kind === "text");
    if (textField) {
      (inst as any)[textField.key] = castValue(node, textField.type);
    }
    return inst;
  }

  if (!isParsedXmlNode(node))
    throw new Error("Root element " + rootName + " not found");
  const inst = new cls();

  const target = inst as Record<string, unknown>;
  const nsMap = collectNs(node, undefined);

  const fields = getAllFields(cls);
  for (const f of fields.filter((f) => f.kind === "attribute")) {
    const k = matchAttributeKey(node, f.name, f.namespace ?? undefined, nsMap);
    if (k) {
      const value = (node as any)[k];
      if (value !== undefined) target[f.key] = castValue(value, f.type);
    }
  }

  for (const f of fields.filter((f) => f.kind === "element")) {
    const k = matchElementKey(node, f.name, f.namespace ?? undefined, nsMap);
    if (!k) continue;
    const val = (node as any)[k];
    if (Array.isArray(val) || (f.isArray && Array.isArray(val))) {
      target[f.key] = (Array.isArray(val) ? val : [val]).map((v) =>
        xmlValueToObject(v, f.type, nsMap)
      );
    } else if (isParsedXmlNode(val) && val["@_xsi:nil"] === "true") {
      target[f.key] = null;
    } else {
      target[f.key] = xmlValueToObject(val, f.type, nsMap);
    }
  }

  const textField = fields.find((f) => f.kind === "text");
  if (textField && node["#text"] !== undefined) {
    target[textField.key] = castValue(node["#text"], textField.type);
  }

  return inst;
}
