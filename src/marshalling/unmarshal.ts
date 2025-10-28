import { XMLParser } from "fast-xml-parser";
import { getMeta, ensureMeta } from "../metadata/MetadataRegistry";
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

function xmlValueToObject<T>(node: ParsedXmlValue, cls: new () => T): T {
  if (isPrimitiveCtor(cls)) {
    // node may be a primitive value or an object with a text node
    if (isParsedXmlNode(node)) {
      if (node["#text"] !== undefined) return castValue(node["#text"], cls);
      return castValue(node, cls);
    }
    return castValue(node, cls);
  }

  const inst = new cls();
  const meta = ensureMeta(cls);
  if (!isParsedXmlNode(node)) return inst;

  const target = inst as Record<string, unknown>;

  for (const f of meta.fields) {
    if (f.kind === "attribute") {
      const attrKey = `@_${f.name || f.key}`;
      if (node[attrKey] !== undefined) {
        target[f.key] = castValue(node[attrKey], f.type);
      }
    } else if (f.kind === "element") {
      const val = node[f.name || f.key];
      if (val !== undefined) {
        if (Array.isArray(val)) {
          target[f.key] = val.map((v) => xmlValueToObject(v, f.type));
        } else if (isParsedXmlNode(val) && val["@_xsi:nil"] === "true") {
          target[f.key] = null;
        } else {
          target[f.key] = xmlValueToObject(val, f.type);
        }
      }
    }
  }

  const textField = meta.fields.find((f) => f.kind === "text");
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
  const node = parsed[rootName];
  if (!isParsedXmlNode(node))
    throw new Error("Root element " + rootName + " not found");
  const inst = new cls();

  const target = inst as Record<string, unknown>;

  for (const f of meta.fields.filter((f) => f.kind === "attribute")) {
    const attrKey = "@_" + f.name;
    const value = node[attrKey];
    if (value !== undefined) {
      target[f.key] = castValue(value, f.type);
    }
  }

  for (const f of meta.fields.filter((f) => f.kind === "element")) {
    const val = node[f.name];
    if (val === undefined) continue;

    if (Array.isArray(val) || (f.isArray && Array.isArray(val))) {
      target[f.key] = (Array.isArray(val) ? val : [val]).map((v) =>
        xmlValueToObject(v, f.type),
      );
    } else if (isParsedXmlNode(val) && val["@_xsi:nil"] === "true") {
      target[f.key] = null;
    } else {
      target[f.key] = xmlValueToObject(val, f.type);
    }
  }

  const textField = meta.fields.find((f) => f.kind === "text");
  if (textField && node["#text"] !== undefined) {
    target[textField.key] = castValue(node["#text"], textField.type);
  }

  return inst;
}
