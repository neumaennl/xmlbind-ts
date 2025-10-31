import type { Element as XmldomElement } from "@xmldom/xmldom";
import { getChildrenByLocalName } from "./utils";

/**
 * Extracts enumeration values from an XSD restriction element.
 *
 * Scans for xs:enumeration child elements and collects their value attributes.
 *
 * @param restriction - The XSD restriction element
 * @param xsdPrefix - The XSD namespace prefix
 * @returns An array of enumeration value strings
 */
export function extractEnumValues(
  restriction: XmldomElement,
  xsdPrefix: string
): string[] {
  const values: string[] = [];
  const enums = getChildrenByLocalName(restriction, "enumeration", xsdPrefix);

  for (const enumEl of enums) {
    const value = (enumEl as XmldomElement).getAttribute("value");
    if (value) values.push(value);
  }
  return values;
}

/**
 * Generates TypeScript enum code from a name and array of values.
 *
 * Creates a standard TypeScript enum with sanitized keys that map to
 * the original string values.
 *
 * @param name - The enum name
 * @param values - Array of enum value strings
 * @returns The complete TypeScript enum code
 */
export function generateEnumCode(name: string, values: string[]): string {
  // Sanitize the enum name - import from types to avoid duplication
  const enumName = sanitizeEnumName(name);

  const lines: string[] = [];
  lines.push(`export enum ${enumName} {`);

  for (const value of values) {
    // Sanitize enum key: replace invalid characters with underscore
    let key = value.replace(/[^A-Za-z0-9_]/g, "_");
    // Ensure key doesn't start with a number
    if (/^[0-9]/.test(key)) {
      key = "_" + key;
    }
    lines.push(`  ${key} = "${value}",`);
  }

  lines.push("}");
  return lines.join("\n");
}

/**
 * Sanitizes an enum name to be a valid TypeScript identifier.
 *
 * @param name - The raw enum name
 * @returns A valid TypeScript enum name
 */
function sanitizeEnumName(name: string): string {
  const reserved = new Set([
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "enum",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "function",
    "if",
    "import",
    "in",
    "instanceof",
    "new",
    "null",
    "return",
    "super",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "with",
    "as",
    "implements",
    "interface",
    "let",
    "package",
    "private",
    "protected",
    "public",
    "static",
    "yield",
    "any",
    "boolean",
    "constructor",
    "declare",
    "get",
    "module",
    "require",
    "number",
    "set",
    "string",
    "symbol",
    "type",
    "from",
    "of",
  ]);

  let typeName = name
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/^[^A-Za-z_]+/, "");

  if (reserved.has(typeName)) {
    typeName = typeName + "_";
  }

  return typeName;
}
