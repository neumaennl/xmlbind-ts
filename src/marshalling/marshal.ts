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
  // Extract comments from metadata with position info
  const commentsData = val._comments;
  if (commentsData && Array.isArray(commentsData)) {
    // Support both old format (strings) and new format (objects with position)
    if (commentsData.length > 0 && typeof commentsData[0] === 'object' && 'text' in commentsData[0]) {
      // New format with positions - store for later interleaving
      nestedNode._commentsWithPos = commentsData;
    } else {
      // Old format - just add at the end
      nestedNode["#comment"] = commentsData;
    }
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

  const textField = fields.find((f: any) => f.kind === "text");
  if (textField) {
    const tv = obj[textField.key];
    if (tv !== undefined && tv !== null) node["#text"] = tv.toString();
  }

  // Handle comments with position information
  const commentsData = (obj as any)._comments;
  if (commentsData && Array.isArray(commentsData) && commentsData.length > 0) {
    // Check if comments have position information
    if (typeof commentsData[0] === 'object' && 'text' in commentsData[0] && 'position' in commentsData[0]) {
      // Store position metadata and comments separately
      const metaStr = commentsData.map((c: any) => `${c.position}|${c.text}`).join('|||');
      node["_commentsWithPositions"] = metaStr;
      // Also add comments as regular nodes (will be repositioned later)
      node["#comment"] = commentsData.map((c: any) => c.text);
    } else {
      // Legacy format: just strings, add at end
      node["#comment"] = commentsData;
    }
  }

  xmlObj[rootName] = node;
  let xml = builder.build(xmlObj);
  
  // Post-process to insert comments at correct positions and convert tags
  xml = insertCommentsAtPositions(xml, rootName);
  xml = postProcessComments(xml);
  
  return xml;
}

/**
 * Inserts comments at their correct positions within the XML string.
 * Uses position information to place comments before/after the appropriate child elements.
 *
 * @param xml - The XML string with <#comment> tags
 * @param rootName - The root element name  
 * @returns XML string with comments repositioned based on position indices
 */
function insertCommentsAtPositions(xml: string, rootName: string): string {
  // Check if we have position metadata
  const metaPattern = /<_commentsWithPositions>(.*?)<\/_commentsWithPositions>/;
  const metaMatch = xml.match(metaPattern);
  
  if (!metaMatch) return xml;
  
  // Parse position data: format is "position|text|||position|text|||..."
  const posData = metaMatch[1];
  const commentObjs: Array<{text: string; position: number}> = [];
  
  if (posData) {
    const parts = posData.split('|||');
    for (const part of parts) {
      const pipeIndex = part.indexOf('|');
      if (pipeIndex > 0) {
        const pos = parseInt(part.substring(0, pipeIndex), 10);
        const text = part.substring(pipeIndex + 1);
        commentObjs.push({ position: pos, text });
      }
    }
  }
  
  // Remove metadata element and all existing <#comment> tags
  xml = xml.replace(metaPattern, '');
  xml = xml.replace(/<#comment>[\s\S]*?<\/#comment>/g, '');
  
  // Find root element bounds
  const rootOpenMatch = xml.match(new RegExp(`<${rootName}[^>]*>`));
  const rootCloseMatch = xml.match(new RegExp(`<\\/${rootName}>`));
  
  if (!rootOpenMatch || !rootCloseMatch) return xml;
  
  const rootStartPos = rootOpenMatch.index! + rootOpenMatch[0].length;
  const rootEndPos = rootCloseMatch.index!;
  const rootContent = xml.substring(rootStartPos, rootEndPos);
  
  // Find all child elements with their positions
  const childElements: Array<{start: number; end: number; text: string}> = [];
  const childPattern = /<(\w+)(?:\s[^>]*)?>[\s\S]*?<\/\1>|<(\w+)[^>]*\/>/g;
  let match;
  
  while ((match = childPattern.exec(rootContent)) !== null) {
    childElements.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0]
    });
  }
  
  // Build new content with comments inserted at correct positions
  let newContent = '';
  let lastPos = 0;
  
  for (let i = 0; i <= childElements.length; i++) {
    // Insert comments that should appear before element at index i
    const commentsHere = commentObjs.filter(c => c.position === i);
    for (const comment of commentsHere) {
      newContent += `\n  <#comment>${comment.text}</#comment>`;
    }
    
    // Add the element if it exists
    if (i < childElements.length) {
      const elem = childElements[i];
      // Add whitespace before element
      const beforeText = rootContent.substring(lastPos, elem.start);
      if (beforeText.trim().length === 0) {
        newContent += '\n  ';
      } else {
        newContent += beforeText;
      }
      newContent += elem.text;
      lastPos = elem.end;
    }
  }
  
  // Add trailing whitespace
  const trailing = rootContent.substring(lastPos);
  if (trailing.trim().length === 0) {
    newContent += '\n';
  } else {
    newContent += trailing;
  }
  
  // Reconstruct XML
  const before = xml.substring(0, rootStartPos);
  const after = xml.substring(rootEndPos);
  
  return before + newContent + after;
}

/**
 * Post-processes XML to convert <#comment>...</#comment> tags to <!-- ... --> comments.
 * This is required because XMLBuilder without commentPropName outputs comment nodes as elements.
 *
 * @param xml - The XML string with <#comment> tags
 * @returns The XML string with proper <!-- --> comment syntax
 */
function postProcessComments(xml: string): string {
  // Replace <#comment>content</#comment> with <!--content-->
  // Use non-greedy match with character class to avoid ReDoS
  return xml.replace(/<#comment>([^<]*(?:<(?!\/#comment>)[^<]*)*)<\/#comment>/g, '<!--$1-->');
}
