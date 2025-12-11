import { XMLBuilder } from "fast-xml-parser";
import { getMeta, getAllFields } from "../metadata/MetadataRegistry";
import { serializePrimitive } from "../util/valueCasting";
import { resolveType } from "../util/typeResolution";
import { isNamespaceDeclaration } from "../util/namespaceUtils";
import { isPrimitiveCtor } from "./types";

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  commentPropName: "#comment", // Enable comment output
  format: true,
  indentBy: "  ",
  suppressBooleanAttributes: false, // Preserve boolean attribute values like mixed="true"
});

type NsContext = {
  defaultNs?: string;
  // Map from namespace URI to prefix
  uriToPrefix: Map<string, string>;
  // Set of prefixes already declared on root
  declared: Set<string>;
  // Root node to which xmlns declarations are attached
  rootNode: any;
  counter: number;
};

/**
 * Adds comments to a node if they exist.
 * Helper function to avoid code duplication in marshal logic.
 *
 * @param node - The node to add comments to
 * @param comments - The array of comment strings
 */
function addCommentsToNode(node: any, comments: string[] | undefined): void {
  if (comments && Array.isArray(comments) && comments.length > 0) {
    node["#comment"] = comments;
  }
}

/**
 * Ensures a namespace prefix exists for the given namespace URI.
 * If no prefix exists, generates a new one and declares it on the root element.
 *
 * @param ns - The namespace URI
 * @param ctx - The namespace context containing prefix mappings
 * @returns The prefix for the given namespace
 */
function ensurePrefix(ns: string, ctx: NsContext): string {
  let p = ctx.uriToPrefix.get(ns);
  if (p) return p;
  p = `ns${++ctx.counter}`;
  ctx.uriToPrefix.set(ns, p);
  // declare on root if not already
  if (!ctx.declared.has(p)) {
    ctx.rootNode[`@_xmlns:${p}`] = ns;
    ctx.declared.add(p);
  }
  return p;
}

/**
 * Constructs a qualified XML name (QName) with the appropriate namespace prefix.
 * Handles default namespace and special rules for attributes (which don't use default namespace).
 *
 * @param local - The local name of the element or attribute
 * @param ns - The namespace URI (optional)
 * @param ctx - The namespace context
 * @param isAttribute - Whether this is an attribute name (default: false)
 * @returns The qualified name with prefix, or just the local name if no namespace
 */
function qName(
  local: string,
  ns: string | undefined,
  ctx: NsContext,
  isAttribute = false
): string {
  if (!ns) return local;
  // default namespace never applies to attributes; force prefix if attribute
  if (!isAttribute && ctx.defaultNs && ns === ctx.defaultNs) {
    return local;
  }
  const prefix = ensurePrefix(ns, ctx);
  return `${prefix}:${local}`;
}

/**
 * Adds a child element to a node, handling multiple elements with the same name.
 * If a child with the same key already exists, converts it to an array.
 *
 * @param node - The parent node
 * @param key - The element key/name
 * @param value - The value to add
 */
function addChild(node: any, key: string, value: any) {
  const existing = node[key];
  if (existing === undefined) {
    node[key] = value;
  } else if (Array.isArray(existing)) {
    existing.push(value);
  } else {
    node[key] = [existing, value];
  }
}

/**
 * Writes wildcard elements (xs:any) to a node.
 * Merges object properties as child elements directly into the parent node.
 *
 * @param node - The parent node to add elements to
 * @param anyArr - Array of wildcard elements (objects or primitives)
 */
function writeAnyElements(node: any, anyArr: unknown[]) {
  if (!Array.isArray(anyArr)) return;
  for (const item of anyArr) {
    if (item == null) continue;
    if (typeof item === "object" && !Array.isArray(item)) {
      const obj = item as Record<string, any>;
      for (const k of Object.keys(obj)) {
        addChild(node, k, obj[k]);
      }
    }
    // primitives are ignored because we don't know the element name
  }
}

/**
 * Converts a JavaScript value to its XML representation.
 * Handles primitives, complex objects with metadata, and nested structures.
 *
 * @param val - The value to convert
 * @param type - The type constructor (String, Number, custom class, etc.)
 * @param ctx - The namespace context
 * @returns The XML representation of the value
 */
function elementToXmlValue(val: any, type: any, ctx: NsContext) {
  if (val === null || val === undefined) return null;
  if (isPrimitiveCtor(type) || typeof val !== "object")
    return serializePrimitive(val, type);
  const nestedMeta = getMeta(type);
  if (!nestedMeta) return val;
  const nestedNode: any = {};
  const nestedFields = getAllFields(type);
  for (const nf of nestedFields.filter((ff: any) => ff.kind === "attribute")) {
    const v = val[nf.key];
    if (v !== undefined && v !== null)
      nestedNode[`@_${qName(nf.name, nf.namespace ?? undefined, ctx, true)}`] =
        serializePrimitive(v, resolveType(nf.type));
  }
  for (const nf of nestedFields.filter((ff: any) => ff.kind === "element")) {
    const v = val[nf.key];
    if (v === undefined) continue;
    const key = qName(nf.name, nf.namespace ?? undefined, ctx, false);
    const resolvedNfType = resolveType(nf.type);
    if (v === null) nestedNode[key] = { "@_xsi:nil": "true" };
    else if (nf.isArray && Array.isArray(v))
      nestedNode[key] = v.map((el: any) => elementToXmlValue(el, resolvedNfType, ctx));
    else nestedNode[key] = elementToXmlValue(v, resolvedNfType, ctx);
  }
  // wildcard attributes on nested objects
  const anyAttrF = nestedFields.find((ff: any) => ff.kind === "anyAttribute");
  if (anyAttrF) {
    const map = val[anyAttrF.key];
    if (map && typeof map === "object") {
      for (const [k, v] of Object.entries(map)) {
        // Skip xmlns declarations as they are already handled by the namespace context
        if (isNamespaceDeclaration(k)) continue;
        nestedNode[`@_${k}`] = String(v as any);
      }
    }
  }
  // wildcard elements on nested objects
  const anyElemF = nestedFields.find((ff: any) => ff.kind === "anyElement");
  if (anyElemF) {
    const arr = val[anyElemF.key];
    if (arr) writeAnyElements(nestedNode, arr);
  }
  // Add comments
  const commentsF = nestedFields.find((ff: any) => ff.kind === "comments");
  if (commentsF) {
    addCommentsToNode(nestedNode, val[commentsF.key]);
  }
  const textF = nestedFields.find((ff: any) => ff.kind === "text");
  if (textF && val[textF.key] !== undefined && val[textF.key] !== null)
    nestedNode["#text"] = String(val[textF.key]);
  return nestedNode;
}

/**
 * Marshals a JavaScript object to an XML string.
 *
 * The object must have @XmlRoot metadata defined. All decorated properties
 * (@XmlElement, @XmlAttribute, @XmlText, etc.) will be serialized to XML.
 * Handles namespaces, prefixes, arrays, nested objects, and wildcard elements/attributes.
 *
 * @param obj - The object to marshal (must have @XmlRoot decorator)
 * @returns The XML string representation
 * @throws {Error} If the object has no XmlRoot metadata
 */
export function marshal(obj: any): string {
  if (!obj) return "";
  const ctor = obj.constructor;
  const meta = getMeta(ctor);
  if (!meta) throw new Error("No XmlRoot metadata for " + ctor.name);

  const rootName = meta.rootName ?? ctor.name;
  const xmlObj: any = {};
  const node: any = {};

  if (meta.namespace) node["@_xmlns"] = meta.namespace;

  const ctx: NsContext = {
    defaultNs: meta.namespace ?? undefined,
    uriToPrefix: new Map<string, string>(),
    declared: new Set<string>(),
    rootNode: node,
    counter: 0,
  };

  // Seed known prefixes from @XmlRoot options
  if (meta.prefixes) {
    for (const [uri, pfx] of Object.entries(meta.prefixes)) {
      ctx.uriToPrefix.set(uri, pfx);
      // pre-declare on root
      node[`@_xmlns:${pfx}`] = uri;
      ctx.declared.add(pfx);
    }
  }

  const fields = getAllFields(ctor);

  for (const f of fields.filter((f: any) => f.kind === "attribute")) {
    const val = obj[f.key];
    if (val === undefined || val === null) continue;
    const key = qName(f.name, f.namespace ?? undefined, ctx, true);
    node[`@_${key}`] = serializePrimitive(val, resolveType(f.type));
  }

  for (const f of fields.filter((f: any) => f.kind === "element")) {
    const val = obj[f.key];
    if (val === undefined) continue;
    const key = qName(f.name, f.namespace ?? undefined, ctx, false);
    const resolvedFType = resolveType(f.type);
    if (val === null) {
      node[key] = { "@_xsi:nil": "true" };
      continue;
    }
    if (f.isArray && Array.isArray(val))
      node[key] = val.map((el: any) => elementToXmlValue(el, resolvedFType, ctx));
    else {
      node[key] = elementToXmlValue(val, resolvedFType, ctx);
      // Merge child class-known prefixes into context for future siblings if not already present
      if (resolvedFType) {
        const childMeta = getMeta(resolvedFType);
        if (childMeta?.prefixes) {
          for (const [uri, pfx] of Object.entries(childMeta.prefixes)) {
            if (!ctx.uriToPrefix.has(uri)) {
              ctx.uriToPrefix.set(uri, pfx);
              if (!ctx.declared.has(pfx)) {
                node[`@_xmlns:${pfx}`] = uri;
                ctx.declared.add(pfx);
              }
            }
          }
        }
      }
    }
  }

  // wildcard attributes on root
  const anyAttrField = fields.find((f: any) => f.kind === "anyAttribute");
  if (anyAttrField) {
    const map = (obj as any)[anyAttrField.key];
    if (map && typeof map === "object") {
      for (const [k, v] of Object.entries(map)) {
        // Skip xmlns declarations as they are already handled by the namespace context
        if (isNamespaceDeclaration(k)) continue;
        node[`@_${k}`] = String(v as any);
      }
    }
  }

  // wildcard elements on root
  const anyElemField = fields.find((f: any) => f.kind === "anyElement");
  if (anyElemField) {
    const arr = (obj as any)[anyElemField.key];
    if (arr) writeAnyElements(node, arr);
  }

  // Add comments
  const commentsField = fields.find((f: any) => f.kind === "comments");
  if (commentsField) {
    addCommentsToNode(node, (obj as any)[commentsField.key]);
  }

  const textField = fields.find((f: any) => f.kind === "text");
  if (textField) {
    const tv = obj[textField.key];
    if (tv !== undefined && tv !== null) node["#text"] = tv.toString();
  }

  xmlObj[rootName] = node;
  return builder.build(xmlObj);
}
