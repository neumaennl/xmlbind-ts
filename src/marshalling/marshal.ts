import { XMLBuilder } from "fast-xml-parser";
import { getMeta, getAllFields } from "../metadata/MetadataRegistry";
import { serializePrimitive } from "../util/valueCasting";
import { resolveType } from "../util/typeResolution";
import { isNamespaceDeclaration } from "../util/namespaceUtils";
import { isPrimitiveCtor } from "./types";
import { hasPositionedComments, groupCommentsByPosition } from "./commentUtils";
import { sortFieldsByElementOrder } from "./elementOrderUtils";
import {
  qName,
  writeAnyElements,
  postProcessComments,
  type NsContext,
} from "./marshalContext";

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  format: true,
  indentBy: "  ",
  suppressBooleanAttributes: false, // Preserve boolean attribute values like mixed="true"
  suppressEmptyNode: true, // Use self-closing tags for empty elements
});

/**
 * Processes attributes for a nested object.
 * @param nestedNode - The XML node
 * @param val - The source value
 * @param nestedFields - Fields metadata
 * @param ctx - Namespace context
 */
function processNestedAttributes(
  nestedNode: any,
  val: any,
  nestedFields: any[],
  ctx: NsContext
): void {
  for (const nf of nestedFields.filter((ff: any) => ff.kind === "attribute")) {
    const v = val[nf.key];
    if (v !== undefined && v !== null)
      nestedNode[`@_${qName(nf.name, nf.namespace ?? undefined, ctx, true)}`] =
        serializePrimitive(v, resolveType(nf.type));
  }
}

/**
 * Adds element fields with positioned comments to node.
 * @param nestedNode - The XML node
 * @param val - The source value
 * @param elementFields - Element fields metadata
 * @param commentsData - Comments data
 * @param ctx - Namespace context
 */
function addElementsWithComments(
  nestedNode: any,
  val: any,
  elementFields: any[],
  commentsData: any,
  ctx: NsContext
): void {
  const commentsByPosition = groupCommentsByPosition(commentsData);
  let commentCounter = 0;

  for (let i = 0; i <= elementFields.length; i++) {
    const commentsAtPos = commentsByPosition.get(i) || [];
    for (const commentText of commentsAtPos) {
      nestedNode[`#comment${commentCounter}`] = commentText;
      commentCounter++;
    }

    if (i < elementFields.length) {
      const nf = elementFields[i];
      const v = val[nf.key];
      if (v !== undefined) {
        const key = qName(nf.name, nf.namespace ?? undefined, ctx, false);
        const resolvedNfType = resolveType(nf.type);
        if (v === null) {
          nestedNode[key] = { "@_xsi:nil": "true" };
        } else if (nf.isArray && Array.isArray(v)) {
          nestedNode[key] = v.map((el: any) =>
            elementToXmlValue(el, resolvedNfType, ctx)
          );
        } else {
          nestedNode[key] = elementToXmlValue(v, resolvedNfType, ctx);
        }
      }
    }
  }
}

/**
 * Adds element fields without positioned comments to node.
 * @param nestedNode - The XML node
 * @param val - The source value
 * @param elementFields - Element fields metadata
 * @param commentsData - Comments data (legacy format)
 * @param ctx - Namespace context
 */
function addElementsWithoutComments(
  nestedNode: any,
  val: any,
  elementFields: any[],
  commentsData: any,
  ctx: NsContext
): void {
  for (const nf of elementFields) {
    const v = val[nf.key];
    if (v === undefined) continue;
    const key = qName(nf.name, nf.namespace ?? undefined, ctx, false);
    const resolvedNfType = resolveType(nf.type);
    if (v === null) nestedNode[key] = { "@_xsi:nil": "true" };
    else if (nf.isArray && Array.isArray(v))
      nestedNode[key] = v.map((el: any) =>
        elementToXmlValue(el, resolvedNfType, ctx)
      );
    else nestedNode[key] = elementToXmlValue(v, resolvedNfType, ctx);
  }

  if (commentsData && Array.isArray(commentsData) && commentsData.length > 0) {
    nestedNode["#comment"] = commentsData;
  }
}

/**
 * Processes wildcard fields for a nested object.
 * @param nestedNode - The XML node
 * @param val - The source value
 * @param nestedFields - Fields metadata
 */
function processNestedWildcards(
  nestedNode: any,
  val: any,
  nestedFields: any[]
): void {
  const anyAttrF = nestedFields.find((ff: any) => ff.kind === "anyAttribute");
  if (anyAttrF) {
    const map = val[anyAttrF.key];
    if (map && typeof map === "object") {
      for (const [k, v] of Object.entries(map)) {
        if (isNamespaceDeclaration(k)) continue;
        nestedNode[`@_${k}`] = String(v as any);
      }
    }
  }

  const anyElemF = nestedFields.find((ff: any) => ff.kind === "anyElement");
  if (anyElemF) {
    const arr = val[anyElemF.key];
    if (arr) writeAnyElements(nestedNode, arr);
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

  // Process attributes
  processNestedAttributes(nestedNode, val, nestedFields, ctx);

  // Get element fields and sort by element order
  const commentsData = val._comments;
  const hasPositioned = hasPositionedComments(commentsData);
  let elementFields = nestedFields.filter((ff: any) => ff.kind === "element");
  elementFields = sortFieldsByElementOrder(elementFields, val._elementOrder);

  // Add elements with or without positioned comments
  if (hasPositioned) {
    addElementsWithComments(nestedNode, val, elementFields, commentsData, ctx);
  } else {
    addElementsWithoutComments(
      nestedNode,
      val,
      elementFields,
      commentsData,
      ctx
    );
  }

  // Process wildcard fields
  processNestedWildcards(nestedNode, val, nestedFields);

  // Add text field
  const textF = nestedFields.find((ff: any) => ff.kind === "text");
  if (textF && val[textF.key] !== undefined && val[textF.key] !== null)
    nestedNode["#text"] = String(val[textF.key]);

  return nestedNode;
}

/**
 * Initializes the namespace context for marshalling.
 * Uses `obj._namespacePrefixes` (prefix → URI) if set on the object; otherwise falls back
 * to `meta.prefixes` (URI → prefix) from the decorator.
 * @param meta - The root metadata
 * @param node - The root XML node
 * @param obj - The source object (may have `_namespacePrefixes`)
 * @returns The initialized namespace context
 */
function initializeNsContext(meta: any, node: any, obj?: any): NsContext {
  const nsPrefixes = obj?._namespacePrefixes as
    | Record<string, string>
    | undefined;

  const ctx: NsContext = {
    defaultNs: meta.namespace ?? undefined,
    uriToPrefix: new Map<string, string>(),
    declared: new Set<string>(),
    rootNode: node,
    counter: 0,
    userDefinedPrefixes: nsPrefixes !== undefined,
  };

  if (nsPrefixes) {
    // Use runtime namespace prefixes (prefix → URI), skipping the default namespace entry
    for (const [pfx, uri] of Object.entries(nsPrefixes)) {
      if (!pfx) continue; // skip default namespace (handled by meta.namespace / "@_xmlns")
      ctx.uriToPrefix.set(uri, pfx);
      node[`@_xmlns:${pfx}`] = uri;
      ctx.declared.add(pfx);
    }
  } else if (meta.prefixes) {
    // Fall back to decorator-defined prefixes (URI → prefix)
    for (const [uri, pfx] of Object.entries(meta.prefixes)) {
      ctx.uriToPrefix.set(uri, String(pfx));
      node[`@_xmlns:${pfx}`] = uri;
      ctx.declared.add(String(pfx));
    }
  }

  return ctx;
}

/**
 * Processes root-level attributes.
 * @param node - The root XML node
 * @param obj - The source object
 * @param fields - All fields
 * @param ctx - Namespace context
 */
function processRootAttributes(
  node: any,
  obj: any,
  fields: any[],
  ctx: NsContext
): void {
  for (const f of fields.filter((f: any) => f.kind === "attribute")) {
    const val = obj[f.key];
    if (val === undefined || val === null) continue;
    const key = qName(f.name, f.namespace ?? undefined, ctx, true);
    node[`@_${key}`] = serializePrimitive(val, resolveType(f.type));
  }
}

/**
 * Merges child class prefixes into namespace context.
 * Skipped when the root object supplied its own `_namespacePrefixes`, because in
 * that case the caller controls exactly which namespace declarations appear in the
 * output and adding extras would make roundtrips inconsistent.
 * @param ctx - Namespace context
 * @param node - Root XML node
 * @param resolvedFType - Resolved field type
 */
function mergeChildPrefixes(
  ctx: NsContext,
  node: any,
  resolvedFType: any
): void {
  if (ctx.userDefinedPrefixes) return;
  if (resolvedFType) {
    const childMeta = getMeta(resolvedFType);
    if (childMeta?.prefixes) {
      for (const [uri, pfx] of Object.entries(childMeta.prefixes)) {
        const prefix = String(pfx);
        if (!ctx.uriToPrefix.has(uri)) {
          ctx.uriToPrefix.set(uri, prefix);
          if (!ctx.declared.has(prefix)) {
            node[`@_xmlns:${prefix}`] = uri;
            ctx.declared.add(prefix);
          }
        }
      }
    }
  }
}

/**
 * Adds root-level elements with positioned comments.
 * @param node - The root XML node
 * @param obj - The source object
 * @param elementFields - Element fields
 * @param commentsData - Comments data
 * @param ctx - Namespace context
 */
function addRootElementsWithComments(
  node: any,
  obj: any,
  elementFields: any[],
  commentsData: any,
  ctx: NsContext
): void {
  const commentsByPosition = groupCommentsByPosition(commentsData);
  let commentCounter = 0;

  for (let i = 0; i <= elementFields.length; i++) {
    const commentsAtPos = commentsByPosition.get(i) || [];
    for (const commentText of commentsAtPos) {
      node[`#comment${commentCounter}`] = commentText;
      commentCounter++;
    }

    if (i < elementFields.length) {
      const f = elementFields[i];
      const val = obj[f.key];
      if (val !== undefined) {
        const key = qName(f.name, f.namespace ?? undefined, ctx, false);
        const resolvedFType = resolveType(f.type);
        if (val === null) {
          node[key] = { "@_xsi:nil": "true" };
        } else if (f.isArray && Array.isArray(val)) {
          node[key] = val.map((el: any) =>
            elementToXmlValue(el, resolvedFType, ctx)
          );
        } else {
          node[key] = elementToXmlValue(val, resolvedFType, ctx);
          mergeChildPrefixes(ctx, node, resolvedFType);
        }
      }
    }
  }
}

/**
 * Adds root-level elements without positioned comments.
 * @param node - The root XML node
 * @param obj - The source object
 * @param elementFields - Element fields
 * @param commentsData - Comments data
 * @param ctx - Namespace context
 */
function addRootElementsWithoutComments(
  node: any,
  obj: any,
  elementFields: any[],
  commentsData: any,
  ctx: NsContext
): void {
  for (const f of elementFields) {
    const val = obj[f.key];
    if (val === undefined) continue;
    const key = qName(f.name, f.namespace ?? undefined, ctx, false);
    const resolvedFType = resolveType(f.type);
    if (val === null) {
      node[key] = { "@_xsi:nil": "true" };
      continue;
    }
    if (f.isArray && Array.isArray(val))
      node[key] = val.map((el: any) =>
        elementToXmlValue(el, resolvedFType, ctx)
      );
    else {
      node[key] = elementToXmlValue(val, resolvedFType, ctx);
      mergeChildPrefixes(ctx, node, resolvedFType);
    }
  }

  if (commentsData && Array.isArray(commentsData) && commentsData.length > 0) {
    node["#comment"] = commentsData;
  }
}

/**
 * Processes root-level wildcard fields and text.
 * @param node - The root XML node
 * @param obj - The source object
 * @param fields - All fields
 */
function processRootWildcardsAndText(node: any, obj: any, fields: any[]): void {
  const anyAttrField = fields.find((f: any) => f.kind === "anyAttribute");
  if (anyAttrField) {
    const map = obj[anyAttrField.key];
    if (map && typeof map === "object") {
      for (const [k, v] of Object.entries(map)) {
        if (isNamespaceDeclaration(k)) continue;
        node[`@_${k}`] = String(v as any);
      }
    }
  }

  const anyElemField = fields.find((f: any) => f.kind === "anyElement");
  if (anyElemField) {
    const arr = obj[anyElemField.key];
    if (arr) writeAnyElements(node, arr);
  }

  const textField = fields.find((f: any) => f.kind === "text");
  if (textField) {
    const tv = obj[textField.key];
    if (tv !== undefined && tv !== null) node["#text"] = tv.toString();
  }
}

/**
 * Post-processes the XML string to add declarations and document comments.
 * @param xml - The base XML string
 * @param obj - The source object
 * @returns The final XML string
 */
function postProcessXml(xml: string, obj: any): string {
  xml = postProcessComments(xml);

  if (obj._hasXmlDeclaration) {
    xml = `<?xml version="1.0" encoding="UTF-8"?>\n` + xml;
  }

  const documentComments = obj._documentComments;
  if (
    documentComments &&
    Array.isArray(documentComments) &&
    documentComments.length > 0
  ) {
    const xmlDeclEnd = xml.indexOf("?>");
    if (xmlDeclEnd >= 0) {
      const beforeDecl = xml.substring(0, xmlDeclEnd + 2);
      const afterDecl = xml.substring(xmlDeclEnd + 2);
      const commentLines = documentComments
        .map((c: string) => `<!--${c}-->`)
        .join("\n");
      xml = beforeDecl + "\n" + commentLines + afterDecl;
    } else {
      const commentLines = documentComments
        .map((c: string) => `<!--${c}-->`)
        .join("\n");
      xml = commentLines + "\n" + xml;
    }
  }

  return xml;
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

  const ctx = initializeNsContext(meta, node, obj);
  const fields = getAllFields(ctor);

  // Process attributes
  processRootAttributes(node, obj, fields, ctx);

  // Get element fields and sort by element order
  const commentsData = obj._comments;
  const hasPositioned = hasPositionedComments(commentsData);
  let elementFields = fields.filter((f: any) => f.kind === "element");
  elementFields = sortFieldsByElementOrder(elementFields, obj._elementOrder);

  // Add elements with or without positioned comments
  if (hasPositioned) {
    addRootElementsWithComments(node, obj, elementFields, commentsData, ctx);
  } else {
    addRootElementsWithoutComments(node, obj, elementFields, commentsData, ctx);
  }

  // Process wildcard fields and text
  processRootWildcardsAndText(node, obj, fields);

  xmlObj[rootName] = node;
  const xml = builder.build(xmlObj);

  return postProcessXml(xml, obj);
}
