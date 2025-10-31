import { DOMParser } from "@xmldom/xmldom";
import type {
  Document as XmldomDocument,
  Element as XmldomElement,
} from "@xmldom/xmldom";

const XSD_NAMESPACE = "http://www.w3.org/2001/XMLSchema";

/**
 * Parses an XSD schema text into an XML DOM document.
 *
 * @param xsdText - The XSD schema content as a string
 * @returns The parsed XML document
 */
export function parseXsd(xsdText: string): XmldomDocument {
  return new DOMParser().parseFromString(xsdText, "application/xml");
}

/**
 * Finds and returns the root schema element from an XSD document.
 *
 * Attempts to locate the schema element using namespace-aware lookup first,
 * then falls back to common prefix patterns (xsd:schema, xs:schema, schema).
 *
 * @param doc - The parsed XSD document
 * @returns The schema root element, or undefined if not found
 */
export function getSchemaRoot(doc: XmldomDocument): XmldomElement | undefined {
  // Try to find schema element by namespace URI first
  const schemas = doc.getElementsByTagNameNS(XSD_NAMESPACE, "schema");
  if (schemas && schemas.length > 0) {
    return schemas[0] as XmldomElement;
  }

  // Fallback to common prefixes
  return (doc.getElementsByTagName("xsd:schema")[0] ||
    doc.getElementsByTagName("xs:schema")[0] ||
    doc.getElementsByTagName("schema")[0]) as XmldomElement | undefined;
}

/**
 * Determines the namespace prefix used for XSD elements in the schema.
 *
 * Checks the schema element's node name for a prefix, or scans xmlns attributes
 * to find which prefix is bound to the XSD namespace URI.
 *
 * @param schema - The schema root element
 * @returns The XSD namespace prefix (e.g., "xsd", "xs"), or empty string for default namespace, or "xsd" as fallback
 */
export function getXsdPrefix(schema: XmldomElement): string {
  // Check if schema element has a prefix
  const nodeName = schema.nodeName || schema.tagName;
  if (nodeName.includes(":")) {
    return nodeName.split(":")[0];
  }

  // Look for xmlns declaration that matches XSD namespace
  const attrs = schema.attributes;
  if (attrs) {
    for (let i = 0; i < attrs.length; i++) {
      const attr = attrs[i];
      const name = attr.nodeName || attr.name;
      const value = attr.nodeValue || attr.value;

      if (value === XSD_NAMESPACE) {
        if (name === "xmlns") {
          return ""; // default namespace, no prefix
        }
        if (name.startsWith("xmlns:")) {
          return name.substring(6);
        }
      }
    }
  }

  return "xsd"; // fallback default
}
