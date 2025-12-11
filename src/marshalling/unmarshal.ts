import { XMLParser } from "fast-xml-parser";
import {
  getMeta,
  ensureMeta,
  getAllFields,
} from "../metadata/MetadataRegistry";
import { castValue } from "../util/valueCasting";
import { resolveType } from "../util/typeResolution";
import {
  ParsedXmlNode,
  ParsedXmlValue,
  isParsedXmlNode,
  isPrimitiveCtor,
} from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
});

type NsMap = { [prefix: string]: string };

/**
 * Collects namespace declarations from an XML node, inheriting from parent context.
 * Scans for xmlns and xmlns:prefix attributes to build a prefix-to-URI mapping.
 *
 * @param node - The XML node to scan for namespace declarations
 * @param parent - The parent namespace map to inherit from (optional)
 * @returns A map of namespace prefixes to URIs
 */
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

/**
 * Finds an element key in the parsed XML node that matches the given local name and namespace.
 * Handles both prefixed and unprefixed element names.
 *
 * @param node - The parsed XML node
 * @param local - The local name of the element
 * @param ns - The expected namespace URI (optional)
 * @param nsMap - The namespace prefix mapping
 * @returns The matching key from the node, or undefined if not found
 */
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

/**
 * Finds an attribute key in the parsed XML node that matches the given local name and namespace.
 * Note: Default namespace doesn't apply to attributes; they must be explicitly prefixed.
 *
 * @param node - The parsed XML node
 * @param local - The local name of the attribute
 * @param ns - The expected namespace URI (optional)
 * @param nsMap - The namespace prefix mapping
 * @returns The matching attribute key from the node (with @_ prefix), or undefined if not found
 */
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

/**
 * Collects wildcard attributes that were not already bound to explicit fields.
 * Excludes xmlns namespace declarations as they are handled separately by the namespace context.
 *
 * @param node - The parsed XML node
 * @param fields - All fields from the class metadata
 * @param nsMap - The namespace prefix mapping
 * @returns A record of unbound attribute names to values
 */
function collectWildcardAttributes(
  node: ParsedXmlNode,
  fields: any[],
  nsMap: NsMap
): Record<string, string> {
  const boundAttrKeys = new Set<string>();
  for (const f of fields.filter((f) => f.kind === "attribute")) {
    const k = matchAttributeKey(
      node,
      f.name || f.key,
      f.namespace ?? undefined,
      nsMap
    );
    if (k) boundAttrKeys.add(k);
  }
  const collected: Record<string, string> = {};
  for (const key of Object.keys(node)) {
    if (!key.startsWith("@_")) continue;
    if (boundAttrKeys.has(key)) continue;
    const attrName = key.substring(2);
    // Skip xmlns declarations as they are handled by the namespace context
    if (attrName === "xmlns" || attrName.startsWith("xmlns:")) continue;
    const v = (node as any)[key];
    if (v !== undefined) collected[attrName] = String(v);
  }
  return collected;
}

/**
 * Collects wildcard elements that were not already bound to explicit fields.
 *
 * @param node - The parsed XML node
 * @param fields - All fields from the class metadata
 * @param nsMap - The namespace prefix mapping
 * @returns An array of unbound element values
 */
function collectWildcardElements(
  node: ParsedXmlNode,
  fields: any[],
  nsMap: NsMap
): any[] {
  const boundElemKeys = new Set<string>();
  for (const f of fields.filter((f) => f.kind === "element")) {
    const k = matchElementKey(
      node,
      f.name || f.key,
      f.namespace ?? undefined,
      nsMap
    );
    if (k) boundElemKeys.add(k);
  }
  const collected: any[] = [];
  for (const key of Object.keys(node)) {
    if (key.startsWith("@_") || key === "#text") continue;
    if (boundElemKeys.has(key)) continue;
    collected.push((node as any)[key]);
  }
  return collected;
}

/**
 * Converts a parsed XML value to a typed JavaScript object.
 * Recursively processes nested elements, attributes, text nodes, and wildcard fields.
 *
 * @param node - The parsed XML value (primitive or node)
 * @param cls - The target class constructor
 * @param nsMap - The namespace prefix mapping
 * @returns An instance of the target class populated with XML data
 */
function xmlValueToObject<T>(
  node: ParsedXmlValue,
  cls: (new () => T) | undefined,
  nsMap: NsMap
): T {
  // If no type specified (cls is undefined), return the raw parsed value
  if (!cls) {
    return node as T;
  }

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

  // Handle case where node is a plain primitive value (string/number/boolean)
  // This happens when an element contains only text with no attributes or child elements
  // E.g., <documentation>text here</documentation> is parsed as just "text here"
  if (!isParsedXmlNode(node)) {
    const target = inst as Record<string, unknown>;
    const fields = getAllFields(cls);
    const textField = fields.find((f) => f.kind === "text");
    if (textField) {
      target[textField.key] = castValue(node, resolveType(textField.type));
    }
    return inst;
  }

  const target = inst as Record<string, unknown>;
  const hereNs = collectNs(node, nsMap);

  const fields = getAllFields(cls);
  // First, bind explicit attributes and elements
  for (const f of fields) {
    if (f.kind === "attribute") {
      const k = matchAttributeKey(
        node,
        f.name || f.key,
        f.namespace ?? undefined,
        hereNs
      );
      if (k && (node as any)[k] !== undefined) {
        target[f.key] = castValue((node as any)[k], resolveType(f.type));
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
        const resolvedType = resolveType(f.type);
        if (Array.isArray(val)) {
          target[f.key] = val.map((v) => xmlValueToObject(v, resolvedType, hereNs));
        } else if (isParsedXmlNode(val) && val["@_xsi:nil"] === "true") {
          target[f.key] = null;
        } else {
          target[f.key] = xmlValueToObject(val, resolvedType, hereNs);
        }
      }
    }
  }

  // Wildcard attributes: collect any attributes not already bound
  const anyAttrField = fields.find((f) => f.kind === "anyAttribute");
  if (anyAttrField) {
    (target as any)[anyAttrField.key] = collectWildcardAttributes(
      node,
      fields,
      hereNs
    );
  }

  // Wildcard elements: collect any child elements not already bound
  const anyElemField = fields.find((f) => f.kind === "anyElement");
  if (anyElemField) {
    (target as any)[anyElemField.key] = collectWildcardElements(
      node,
      fields,
      hereNs
    );
  }

  const textField = fields.find((f) => f.kind === "text");
  if (textField && node["#text"] !== undefined) {
    target[textField.key] = castValue(node["#text"], resolveType(textField.type));
  }

  return inst;
}

/**
 * Unmarshals an XML string to a typed JavaScript object.
 *
 * The target class must have @XmlRoot metadata defined. The XML root element
 * must match the root name specified in the metadata. All decorated properties
 * will be populated from the corresponding XML elements and attributes.
 * Handles namespaces, arrays, nested objects, null values, and wildcard elements/attributes.
 *
 * @param cls - The target class constructor (must have @XmlRoot decorator)
 * @param xml - The XML string to unmarshal
 * @returns An instance of the target class populated with XML data
 * @throws {Error} If the class has no XmlRoot metadata or if the root element is not found
 */
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
      (inst as any)[textField.key] = castValue(node, resolveType(textField.type));
    }
    return inst;
  }

  if (!isParsedXmlNode(node))
    throw new Error("Root element " + rootName + " not found");
  const inst = new cls();

  const target = inst as Record<string, unknown>;
  const nsMap = collectNs(node, undefined);

  const fields = getAllFields(cls);

  // Bind attributes
  for (const f of fields.filter((f) => f.kind === "attribute")) {
    const k = matchAttributeKey(node, f.name, f.namespace ?? undefined, nsMap);
    if (k) {
      const value = (node as any)[k];
      if (value !== undefined) target[f.key] = castValue(value, resolveType(f.type));
    }
  }

  // Bind elements
  for (const f of fields.filter((f) => f.kind === "element")) {
    const k = matchElementKey(node, f.name, f.namespace ?? undefined, nsMap);
    if (!k) continue;
    const val = (node as any)[k];
    const resolvedType = resolveType(f.type);
    if (Array.isArray(val) || (f.isArray && Array.isArray(val))) {
      target[f.key] = (Array.isArray(val) ? val : [val]).map((v) =>
        xmlValueToObject(v, resolvedType, nsMap)
      );
    } else if (isParsedXmlNode(val) && val["@_xsi:nil"] === "true") {
      target[f.key] = null;
    } else {
      target[f.key] = xmlValueToObject(val, resolvedType, nsMap);
    }
  }

  // Collect wildcard attributes
  const anyAttr = fields.find((f) => f.kind === "anyAttribute");
  if (anyAttr) {
    (target as any)[anyAttr.key] = collectWildcardAttributes(
      node,
      fields,
      nsMap
    );
  }

  // Collect wildcard elements
  const anyElem = fields.find((f) => f.kind === "anyElement");
  if (anyElem) {
    (target as any)[anyElem.key] = collectWildcardElements(node, fields, nsMap);
  }

  const textField = fields.find((f) => f.kind === "text");
  if (textField && node["#text"] !== undefined) {
    target[textField.key] = castValue(node["#text"], resolveType(textField.type));
  }

  return inst;
}
