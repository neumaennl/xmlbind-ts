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
import {
  collectNs,
  matchElementKey,
  matchAttributeKey,
  collectWildcardAttributes,
  collectWildcardElements,
  type NsMap,
} from "./namespaceHelpers";
import {
  extractCommentsFromPreserveOrder,
  extractNestedComments,
  extractDocumentLevelComments,
} from "./commentUtils";
import {
  getLocalName,
  extractElementOrderFromPreserveOrder,
  extractNestedElementOrder,
  findElementOccurrences,
} from "./elementOrderUtils";

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

/**
 * Processes a primitive constructor value.
 * @param node - The parsed XML value
 * @param cls - The primitive constructor
 * @returns The casted primitive value
 */
function processPrimitiveValue(node: ParsedXmlValue, cls: any): any {
  if (isParsedXmlNode(node)) {
    if (node["#text"] !== undefined) return castValue(node["#text"], cls);
    return castValue(node, cls);
  }
  return castValue(node, cls);
}

/**
 * Processes a plain text node (element with only text, no attributes).
 * @param node - The primitive value
 * @param inst - The instance to populate
 * @param cls - The class constructor
 * @returns The populated instance
 */
function processPlainTextNode<T>(
  node: ParsedXmlValue,
  inst: T,
  cls: new () => T
): T {
  const target = inst as Record<string, unknown>;
  const fields = getAllFields(cls);
  const textField = fields.find((f) => f.kind === "text");
  if (textField) {
    target[textField.key] = castValue(node, resolveType(textField.type));
  }
  return inst;
}

/**
 * Binds attribute and element fields to the target object.
 * @param target - The target object
 * @param node - The parsed XML node
 * @param fields - All fields
 * @param hereNs - The namespace map
 * @param preserveOrderData - The preserveOrder data
 * @param path - The current path
 */
function bindFieldsToTarget(
  target: Record<string, unknown>,
  node: ParsedXmlNode,
  fields: any[],
  hereNs: NsMap,
  preserveOrderData: any,
  path: string[] | undefined
): void {
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
          // Process array with preserveOrder data
          if (preserveOrderData && path) {
            const itemPath = [...path, f.name || f.key];
            const occurrences = findElementOccurrences(preserveOrderData, itemPath);
            target[f.key] = val.map((v, index) => {
              const itemPreserveOrder = occurrences[index]
                ? [{ _item: occurrences[index] }]
                : undefined;
              return xmlValueToObject(v, resolvedType, hereNs, itemPreserveOrder, ["_item"]);
            });
          } else {
            target[f.key] = val.map((v) =>
              xmlValueToObject(v, resolvedType, hereNs, undefined, undefined)
            );
          }
        } else if (isParsedXmlNode(val) && val["@_xsi:nil"] === "true") {
          target[f.key] = null;
        } else {
          target[f.key] = xmlValueToObject(
            val,
            resolvedType,
            hereNs,
            preserveOrderData,
            path ? [...path, f.name || f.key] : undefined
          );
        }
      }
    }
  }
}

/**
 * Attaches metadata (comments and element order) to the target object.
 * @param target - The target object
 * @param node - The parsed XML node
 * @param preserveOrderData - The preserveOrder data
 * @param path - The current path
 */
function attachObjectMetadata(
  target: Record<string, unknown>,
  node: ParsedXmlNode,
  preserveOrderData: any,
  path: string[] | undefined
): void {
  // Merge comments
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

  // Extract element order
  if (preserveOrderData && path && path.length > 0) {
    const elementOrder = extractNestedElementOrder(preserveOrderData, path);
    if (elementOrder && elementOrder.length > 0) {
      (target as any)._elementOrder = elementOrder;
    }
  }
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
  if (!cls) {
    return node as T;
  }

  if (isPrimitiveCtor(cls)) {
    return processPrimitiveValue(node, cls);
  }

  const inst = new cls();
  ensureMeta(cls);

  if (!isParsedXmlNode(node)) {
    return processPlainTextNode(node, inst, cls);
  }

  const target = inst as Record<string, unknown>;
  const hereNs = collectNs(node, nsMap);
  const fields = getAllFields(cls);

  // Bind attributes and elements
  bindFieldsToTarget(target, node, fields, hereNs, preserveOrderData, path);

  // Wildcard attributes and elements
  const anyAttrField = fields.find((f) => f.kind === "anyAttribute");
  if (anyAttrField) {
    (target as any)[anyAttrField.key] = collectWildcardAttributes(
      node,
      fields,
      hereNs
    );
  }

  const anyElemField = fields.find((f) => f.kind === "anyElement");
  if (anyElemField) {
    (target as any)[anyElemField.key] = collectWildcardElements(
      node,
      fields,
      hereNs
    );
  }

  // Attach metadata
  attachObjectMetadata(target, node, preserveOrderData, path);

  // Bind text node
  const textField = fields.find((f) => f.kind === "text");
  if (textField && node["#text"] !== undefined) {
    target[textField.key] = castValue(node["#text"], resolveType(textField.type));
  }

  return inst;
}

/**
 * Finds the root node from parsed XML, handling namespace prefixes.
 * @param parsed - The parsed XML
 * @param rootName - The expected root element name
 * @returns The root node or undefined
 */
function findRootNode(
  parsed: ParsedXmlNode,
  rootName: string
): ParsedXmlValue | undefined {
  let node: ParsedXmlValue | undefined = (parsed as any)[rootName];
  if (!isParsedXmlNode(node)) {
    for (const key of Object.keys(parsed)) {
      const local = getLocalName(key);
      if (local === rootName) {
        node = (parsed as any)[key];
        break;
      }
    }
  }
  return node;
}

/**
 * Handles simple text value root elements.
 * @param node - The primitive node value
 * @param cls - The class constructor
 * @returns The instance with text field populated
 */
function handleSimpleTextRoot<T>(node: ParsedXmlValue, cls: new () => T): T {
  const inst = new cls();
  const fields = getAllFields(cls);
  const textField = fields.find((f) => f.kind === "text");
  if (textField) {
    (inst as any)[textField.key] = castValue(node, resolveType(textField.type));
  }
  return inst;
}

/**
 * Binds root-level attributes to the target object.
 * @param target - The target object
 * @param node - The parsed XML node
 * @param fields - All fields
 * @param nsMap - Namespace map
 */
function bindRootAttributes(
  target: Record<string, unknown>,
  node: ParsedXmlNode,
  fields: any[],
  nsMap: NsMap
): void {
  for (const f of fields.filter((f) => f.kind === "attribute")) {
    const k = matchAttributeKey(node, f.name, f.namespace ?? undefined, nsMap);
    if (k) {
      const value = (node as any)[k];
      if (value !== undefined)
        target[f.key] = castValue(value, resolveType(f.type));
    }
  }
}

/**
 * Binds root-level elements to the target object.
 * @param target - The target object
 * @param node - The parsed XML node
 * @param fields - All fields
 * @param nsMap - Namespace map
 * @param rootName - The root element name
 * @param parsedWithComments - The preserveOrder parsed data
 */
function bindRootElements(
  target: Record<string, unknown>,
  node: ParsedXmlNode,
  fields: any[],
  nsMap: NsMap,
  rootName: string,
  parsedWithComments: any
): void {
  for (const f of fields.filter((f) => f.kind === "element")) {
    const k = matchElementKey(node, f.name, f.namespace ?? undefined, nsMap);
    if (!k) continue;
    const val = (node as any)[k];
    const resolvedType = resolveType(f.type);
    if (Array.isArray(val) || (f.isArray && Array.isArray(val))) {
      const arrayVal = Array.isArray(val) ? val : [val];
      const itemPath = [rootName, f.name || f.key];
      const occurrences = findElementOccurrences(parsedWithComments, itemPath);
      target[f.key] = arrayVal.map((v, index) => {
        const itemPreserveOrder = occurrences[index]
          ? [{ _item: occurrences[index] }]
          : undefined;
        return xmlValueToObject(v, resolvedType, nsMap, itemPreserveOrder, [
          "_item",
        ]);
      });
    } else if (isParsedXmlNode(val) && val["@_xsi:nil"] === "true") {
      target[f.key] = null;
    } else {
      target[f.key] = xmlValueToObject(
        val,
        resolvedType,
        nsMap,
        parsedWithComments,
        [rootName, f.name || f.key]
      );
    }
  }
}

/**
 * Attaches root-level metadata (comments, element order, document comments, XML declaration,
 * and namespace prefix mappings).
 * @param target - The target object
 * @param parsedWithComments - The preserveOrder parsed data
 * @param rootName - The root element name
 * @param hasXmlDeclaration - Whether XML had declaration
 * @param nsMap - The namespace prefix map collected from the root element
 */
function attachRootMetadata(
  target: Record<string, unknown>,
  parsedWithComments: any,
  rootName: string,
  hasXmlDeclaration: boolean,
  nsMap: NsMap
): void {
  const comments = extractCommentsFromPreserveOrder(
    parsedWithComments,
    rootName
  );
  if (comments && comments.length > 0) {
    (target as any)._comments = comments;
  }

  const elementOrder = extractElementOrderFromPreserveOrder(
    parsedWithComments,
    rootName
  );
  if (elementOrder && elementOrder.length > 0) {
    (target as any)._elementOrder = elementOrder;
  }

  const documentComments = extractDocumentLevelComments(
    parsedWithComments,
    rootName
  );
  if (documentComments && documentComments.length > 0) {
    (target as any)._documentComments = documentComments;
  }

  if (hasXmlDeclaration) {
    (target as any)._hasXmlDeclaration = true;
  }

  // Store named (prefixed) namespace declarations only.
  // The default namespace (empty prefix) is already captured by meta.namespace on the class
  // and is not meaningful for prefix-based lookups.
  const namedPrefixes: Record<string, string> = {};
  for (const [pfx, uri] of Object.entries(nsMap)) {
    if (pfx) namedPrefixes[pfx] = uri;
  }
  (target as any)._namespacePrefixes = namedPrefixes;
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
  const parsedWithComments = commentParser.parse(xml);
  const hasXmlDeclaration = xml.trimStart().startsWith("<?xml");

  if (!meta) throw new Error("No XmlRoot metadata for " + cls.name);
  const rootName = meta.rootName ?? cls.name;

  const node = findRootNode(parsed, rootName);

  if (node !== undefined && !isParsedXmlNode(node)) {
    return handleSimpleTextRoot(node, cls);
  }

  if (!isParsedXmlNode(node))
    throw new Error("Root element " + rootName + " not found");

  const inst = new cls();
  const target = inst as Record<string, unknown>;
  const nsMap = collectNs(node, undefined);
  const fields = getAllFields(cls);

  // Bind attributes and elements
  bindRootAttributes(target, node, fields, nsMap);
  bindRootElements(target, node, fields, nsMap, rootName, parsedWithComments);

  // Collect wildcard attributes and elements
  const anyAttr = fields.find((f) => f.kind === "anyAttribute");
  if (anyAttr) {
    (target as any)[anyAttr.key] = collectWildcardAttributes(
      node,
      fields,
      nsMap
    );
  }

  const anyElem = fields.find((f) => f.kind === "anyElement");
  if (anyElem) {
    (target as any)[anyElem.key] = collectWildcardElements(node, fields, nsMap);
  }

  // Attach metadata
  attachRootMetadata(target, parsedWithComments, rootName, hasXmlDeclaration, nsMap);

  // Bind text node
  const textField = fields.find((f) => f.kind === "text");
  if (textField && node["#text"] !== undefined) {
    target[textField.key] = castValue(
      node["#text"],
      resolveType(textField.type)
    );
  }

  return inst;
}
