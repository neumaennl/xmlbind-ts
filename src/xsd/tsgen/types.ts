import { localName } from "./utils";

/**
 * TypeScript primitive type names that don't require lazy type references.
 * These types are always available and don't have circular dependency issues.
 */
export const TS_PRIMITIVE_TYPES = ["string", "number", "boolean"];

/**
 * Checks if a TypeScript type name is a primitive type.
 * Primitive types don't need lazy type references since they're always available.
 *
 * @param tsType - The TypeScript type name
 * @returns True if the type is a primitive TypeScript type
 */
export function isPrimitiveTypeName(tsType: string): boolean {
  return TS_PRIMITIVE_TYPES.includes(tsType);
}

/**
 * Converts a TypeScript primitive type to its JavaScript constructor for use in decorators.
 * Decorators need the actual constructor function (String, Number, Boolean), not the TypeScript type.
 *
 * @param tsType - The TypeScript type name (string, number, boolean)
 * @returns The JavaScript constructor name (String, Number, Boolean) or the original type if not primitive
 */
export function toDecoratorType(tsType: string): string {
  switch (tsType) {
    case "string":
      return "String";
    case "number":
      return "Number";
    case "boolean":
      return "Boolean";
    default:
      return tsType;
  }
}

/**
 * Maps an XSD type to its corresponding TypeScript type.
 *
 * Handles all built-in XSD types (string, number, boolean, date, etc.)
 * and sanitizes user-defined type names for TypeScript compatibility.
 *
 * @param xsdType - The XSD type name (may be prefixed)
 * @returns The corresponding TypeScript type name
 */
export function typeMapping(xsdType?: string | null): string {
  if (!xsdType) return "string";
  const local = localName(xsdType)!;
  switch (local) {
    case "string":
    case "normalizedString":
    case "token":
    case "language":
    case "Name":
    case "NCName":
    case "ID":
    case "IDREF":
    case "ENTITY":
    case "NMTOKEN":
    case "anyURI":
    case "QName":
    case "NOTATION":
      return "string";
    case "boolean":
      return "boolean";
    case "int":
    case "integer":
    case "long":
    case "short":
    case "byte":
    case "decimal":
    case "float":
    case "double":
    case "unsignedInt":
    case "unsignedLong":
    case "unsignedShort":
    case "unsignedByte":
    case "positiveInteger":
    case "negativeInteger":
    case "nonPositiveInteger":
    case "nonNegativeInteger":
      return "number";
    case "date":
    case "dateTime":
    case "time":
    case "gYear":
    case "gYearMonth":
    case "gMonth":
    case "gMonthDay":
    case "gDay":
    case "duration":
      return "Date";
    case "hexBinary":
    case "base64Binary":
      return "string";
    case "anyType":
    case "anySimpleType":
      return "any";
    default:
      // For user-defined types, sanitize the name
      return sanitizeTypeName(local);
  }
}

/**
 * Sanitizes a type name to be a valid TypeScript identifier.
 *
 * Removes invalid characters, ensures it starts with a valid character,
 * and appends an underscore if it conflicts with reserved words.
 *
 * @param name - The raw type name
 * @returns A valid TypeScript type name
 */
export function sanitizeTypeName(name: string): string {
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

/**
 * Checks if an XSD type is a built-in type (not a user-defined type).
 *
 * @param xsdType - The XSD type name (may be prefixed)
 * @returns True if the type is a standard XSD built-in type
 */
export function isBuiltinType(xsdType?: string | null): boolean {
  if (!xsdType) return false;
  const l = localName(xsdType);
  return (
    l === "string" ||
    l === "normalizedString" ||
    l === "token" ||
    l === "language" ||
    l === "Name" ||
    l === "NCName" ||
    l === "ID" ||
    l === "IDREF" ||
    l === "ENTITY" ||
    l === "NMTOKEN" ||
    l === "anyURI" ||
    l === "QName" ||
    l === "NOTATION" ||
    l === "boolean" ||
    l === "int" ||
    l === "integer" ||
    l === "long" ||
    l === "short" ||
    l === "byte" ||
    l === "decimal" ||
    l === "float" ||
    l === "double" ||
    l === "unsignedInt" ||
    l === "unsignedLong" ||
    l === "unsignedShort" ||
    l === "unsignedByte" ||
    l === "positiveInteger" ||
    l === "negativeInteger" ||
    l === "nonPositiveInteger" ||
    l === "nonNegativeInteger" ||
    l === "date" ||
    l === "dateTime" ||
    l === "time" ||
    l === "gYear" ||
    l === "gYearMonth" ||
    l === "gMonth" ||
    l === "gMonthDay" ||
    l === "gDay" ||
    l === "duration" ||
    l === "hexBinary" ||
    l === "base64Binary" ||
    l === "anyType" ||
    l === "anySimpleType"
  );
}
