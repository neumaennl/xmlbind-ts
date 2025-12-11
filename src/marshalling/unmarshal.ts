import { XMLParser } from "fast-xml-parser";
import {
  getMeta,
  ensureMeta,
  getAllFields,
} from "../metadata/MetadataRegistry";
import { castValue } from "../util/valueCasting";
import { resolveType } from "../util/typeResolution";
import { isNamespaceDeclaration } from "../util/namespaceUtils";
import {
  ParsedXmlNode,
  ParsedXmlValue,
  isParsedXmlNode,
  isPrimitiveCtor,
} from "./types";

// Main parser for data
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
});

// Comment parser with preserveOrder to capture comments with positions
const commentParser = new XMLParser({
  commentPropName: "#comment",
  preserveOrder: true,
  trimValues: false,
  processEntities: false,
  parseTagValue: false,
  parseAttributeValue: false,
});

type NsMap = { [prefix: string]: string };

/**
 * Extracts comments with position information from preserveOrder parsed structure.
 * Returns an array of {comment: string, position: number} objects where position
 * indicates the index where the comment should appear relative to child elements.
 *
 * @param preserveOrderArray - The parsed XML in preserveOrder format
 * @param elementName - The name of the root element to extract comments from
 * @returns An array of comment objects with positions, or undefined if no comments found
 */
function extractCommentsFromPreserveOrder(
  preserveOrderArray: any,
  elementName: string
): Array<{text: string; position: number}> | undefined {
  if (!Array.isArray(preserveOrderArray)) return undefined;

  for (const item of preserveOrderArray) {
    if (!item || typeof item !== "object") continue;

    const elementData = item[elementName];
    if (!elementData || !Array.isArray(elementData)) continue;

    const comments: Array<{text: string; position: number}> = [];
    let elementIndex = 0;

    for (const child of elementData) {
      if (!child || typeof child !== "object") continue;

      // Check if this is a comment node
      if (child["#comment"]) {
        const commentData = child["#comment"];
        if (Array.isArray(commentData) && commentData[0]) {
          const commentText = commentData[0]["#text"];
          if (typeof commentText === "string") {
            comments.push({ text: commentText, position: elementIndex });
          }
        }
      } else if (!child["#text"]) {
        // Non-whitespace element, increment position counter
        elementIndex++;
      }
    }

    return comments.length > 0 ? comments : undefined;
  }

  return undefined;
}

/**
 * Extracts comments from a nested element in preserveOrder structure.
 */
function extractNestedComments(
  preserveOrderData: any,
  path: string[]
): Array<{text: string; position: number}> | undefined {
  if (!Array.isArray(preserveOrderData) || path.length === 0) return undefined;
  let current = preserveOrderData;
  for (const elementName of path) {
    if (!Array.isArray(current)) return undefined;
    let found = false;
    for (const item of current) {
      if (item && typeof item === "object" && item[elementName]) {
        current = item[elementName];
        found = true;
        break;
      }
    }
    if (!found) return undefined;
  }
  if (!Array.isArray(current)) return undefined;
  const comments: Array<{text: string; position: number}> = [];
  let elementIndex = 0;
  for (const child of current) {
    if (!child || typeof child !== "object") continue;
    if (child["#comment"]) {
      const commentData = child["#comment"];
      if (Array.isArray(commentData) && commentData[0]) {
        const commentText = commentData[0]["#text"];
        if (typeof commentText === "string") {
          comments.push({ text: commentText, position: elementIndex });
        }
      }
    } else if (!child["#text"]) {
      elementIndex++;
    }
  }
  return comments.length > 0 ? comments : undefined;
}

/**
 * Extracts the local name from a potentially namespaced element name.
 * For example, "ns:Element" becomes "Element", and "Element" stays "Element".
 *
 * @param name - The element name (potentially with namespace prefix)
 * @returns The local name without namespace prefix
 */
function getLocalName(name: string): string {
  const colonIndex = name.indexOf(":");
  return colonIndex >= 0 ? name.substring(colonIndex + 1) : name;
}

/**
 * Extracts the order of child elements from preserveOrder parsed structure.
 * Returns an array of element names in the order they appear in the XML.
 *
 * @param preserveOrderArray - The parsed XML in preserveOrder format
 * @param elementName - The name of the root element to extract element order from
 * @returns An array of element names in order, or undefined if no elements found
 */
function extractElementOrderFromPreserveOrder(
  preserveOrderArray: unknown,
  elementName: string
): string[] | undefined {
  if (!Array.isArray(preserveOrderArray)) return undefined;

  for (const item of preserveOrderArray) {
    if (!item || typeof item !== "object") continue;

    const elementData = (item as Record<string, unknown>)[elementName];
    if (!elementData || !Array.isArray(elementData)) continue;

    const elementOrder: string[] = [];

    for (const child of elementData) {
      if (!child || typeof child !== "object") continue;

      // Skip comments and text nodes
      if ((child as Record<string, unknown>)["#comment"] || (child as Record<string, unknown>)["#text"]) continue;

      // Extract element names (first key that's not a comment, text, or attribute)
      for (const key of Object.keys(child)) {
        if (key.startsWith("@_") || key === "#comment" || key === "#text") continue;
        elementOrder.push(getLocalName(key));
        break; // Only take the first element key
      }
    }

    return elementOrder.length > 0 ? elementOrder : undefined;
  }

  return undefined;
}

/**
 * Extracts element order from a nested element in preserveOrder structure.
 */
function extractNestedElementOrder(
  preserveOrderData: unknown,
  path: string[]
): string[] | undefined {
  if (!Array.isArray(preserveOrderData) || path.length === 0) return undefined;
  let current: unknown = preserveOrderData;
  for (const elementName of path) {
    if (!Array.isArray(current)) return undefined;
    let found = false;
    for (const item of current) {
      if (item && typeof item === "object" && (item as Record<string, unknown>)[elementName]) {
        current = (item as Record<string, unknown>)[elementName];
        found = true;
        break;
      }
    }
    if (!found) return undefined;
  }
  if (!Array.isArray(current)) return undefined;
  
  const elementOrder: string[] = [];
  for (const child of current) {
    if (!child || typeof child !== "object") continue;

    // Skip comments and text nodes
    if ((child as Record<string, unknown>)["#comment"] || (child as Record<string, unknown>)["#text"]) continue;

    // Extract element names (skip attributes too)
    for (const key of Object.keys(child)) {
      if (key.startsWith("@_") || key === "#comment" || key === "#text") continue;
      elementOrder.push(getLocalName(key));
      break;
    }
  }
  
  return elementOrder.length > 0 ? elementOrder : undefined;
}


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
    if (isNamespaceDeclaration(attrName)) continue;
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
 * @returns An array of unbound element values, each as {elementName: value}
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
    
    const value = (node as any)[key];
    // If the value is an array, it means multiple elements with the same name
    // Each should be added as a separate object {elementName: value}
    if (Array.isArray(value)) {
      for (const item of value) {
        collected.push({ [key]: item });
      }
    } else {
      // Single element
      collected.push({ [key]: value });
    }
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
 * @param preserveOrderData - Optional preserveOrder parsed data for comment extraction
 * @param path - Optional path to this element for nested comment extraction
 * @returns An instance of the target class populated with XML data
 */
function xmlValueToObject<T>(
  node: ParsedXmlValue,
  cls: (new () => T) | undefined,
  nsMap: NsMap,
  preserveOrderData?: any,
  path?: string[]
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
          target[f.key] = val.map((v) => xmlValueToObject(v, resolvedType, hereNs, preserveOrderData, path ? [...path, f.name || f.key] : undefined));
        } else if (isParsedXmlNode(val) && val["@_xsi:nil"] === "true") {
          target[f.key] = null;
        } else {
          target[f.key] = xmlValueToObject(val, resolvedType, hereNs, preserveOrderData, path ? [...path, f.name || f.key] : undefined);
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


  // Merge comments from both extractNestedComments and node["#comment"]
  const mergedComments: any[] = [];
  if (preserveOrderData && path && path.length > 0) {
    const comments = extractNestedComments(preserveOrderData, path);
    if (comments && comments.length > 0) {
      mergedComments.push(...comments);
    }
  }
  if (node["#comment"] !== undefined) {
    const comments = node["#comment"];
    if (Array.isArray(comments)) {
      mergedComments.push(...comments);
    } else {
      mergedComments.push(comments);
    }
  }
  if (mergedComments.length > 0) {
    (target as any)._comments = mergedComments;
  }

  // Extract and store element order from preserveOrder data
  if (preserveOrderData && path && path.length > 0) {
    const elementOrder = extractNestedElementOrder(preserveOrderData, path);
    if (elementOrder && elementOrder.length > 0) {
      (target as any)._elementOrder = elementOrder;
    }
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

  // Also parse with comment parser for extracting comments
  const parsedWithComments = commentParser.parse(xml);

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
        xmlValueToObject(v, resolvedType, nsMap, parsedWithComments, [rootName, f.name || f.key])
      );
    } else if (isParsedXmlNode(val) && val["@_xsi:nil"] === "true") {
      target[f.key] = null;
    } else {
      target[f.key] = xmlValueToObject(val, resolvedType, nsMap, parsedWithComments, [rootName, f.name || f.key]);
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

  // Extract comments using the preserveOrder parser - pass to nested elements
  const comments = extractCommentsFromPreserveOrder(parsedWithComments, rootName);
  if (comments && comments.length > 0) {
    (target as any)._comments = comments;
  }

  // Extract element order using the preserveOrder parser
  const elementOrder = extractElementOrderFromPreserveOrder(parsedWithComments, rootName);
  if (elementOrder && elementOrder.length > 0) {
    (target as any)._elementOrder = elementOrder;
  }

  const textField = fields.find((f) => f.kind === "text");
  if (textField && node["#text"] !== undefined) {
    target[textField.key] = castValue(node["#text"], resolveType(textField.type));
  }

  return inst;
}
