import type { Element as XmldomElement } from "@xmldom/xmldom";
import { localName, getChildByLocalName } from "./utils";
import { typeMapping, sanitizeTypeName, isBuiltinType } from "./types";
import type { SchemaContext } from "./schema";

/**
 * A generation unit representing the code and dependencies for a single class or type.
 */
export interface GenUnit {
  /** The generated TypeScript code lines for the class */
  lines: string[];
  /** Set of type names that this class depends on (for import statements) */
  deps: Set<string>;
}

/**
 * The global state shared across the code generation process.
 * Contains schema information, reserved words, and output maps.
 */
export interface GeneratorState {
  /** The indexed schema context with all type definitions */
  schemaContext: SchemaContext;
  /** The XSD namespace prefix (e.g., "xs" or "xsd") */
  xsdPrefix: string;
  /** Set of JavaScript/TypeScript reserved keywords to avoid */
  reservedWords: Set<string>;
  /** Map of generated enum names to their code */
  generatedEnums: Map<string, string>;
  /** Map of generated class names to their generation units */
  generated: Map<string, GenUnit>;
}

/**
 * Determines the namespace for an element based on its context and form settings.
 *
 * Top-level elements always use the target namespace. For nested elements,
 * checks the element's form attribute, falling back to elementFormDefault.
 *
 * @param e - The XML element
 * @param isTopLevel - Whether this is a top-level schema element
 * @param targetNs - The schema's target namespace
 * @param elementFormDefault - The schema's elementFormDefault value
 * @returns The namespace URI for the element, or undefined for unqualified
 */
export function elementNamespaceFor(
  e: XmldomElement,
  isTopLevel: boolean,
  targetNs: string | undefined,
  elementFormDefault: string
): string | undefined {
  if (isTopLevel) return targetNs;
  const form = e.getAttribute("form");
  if (form === "qualified") return targetNs;
  if (form === "unqualified") return undefined;
  return elementFormDefault === "qualified" ? targetNs : undefined;
}

/**
 * Determines the namespace for an attribute based on its form settings.
 *
 * Unlike elements, attributes don't use the default namespace unless explicitly qualified.
 * Checks the attribute's form attribute, falling back to attributeFormDefault.
 *
 * @param a - The XML attribute element
 * @param targetNs - The schema's target namespace
 * @param attributeFormDefault - The schema's attributeFormDefault value
 * @returns The namespace URI for the attribute, or undefined for unqualified
 */
export function attributeNamespaceFor(
  a: XmldomElement,
  targetNs: string | undefined,
  attributeFormDefault: string
): string | undefined {
  const form = a.getAttribute("form");
  if (form === "qualified") return targetNs;
  if (form === "unqualified") return undefined;
  return attributeFormDefault === "qualified" ? targetNs : undefined;
}

/**
 * Resolves an XSD type reference to a TypeScript type string.
 *
 * Handles built-in XSD types, user-defined enums and simple types, and complex types.
 * Falls back to built-in type mapping or "String" for unrecognized types.
 *
 * @param typeAttr - The XSD type attribute value (may be prefixed)
 * @param state - The generator state containing schema context and type mappings
 * @returns The TypeScript type name
 */
export function resolveType(
  typeAttr: string | null | undefined,
  state: GeneratorState
): string {
  if (!typeAttr) return "String";

  const local = localName(typeAttr)!;

  if (isBuiltinType(typeAttr)) {
    return typeMapping(typeAttr);
  }

  if (state.schemaContext.enumTypesMap.has(local)) {
    return sanitizeTypeName(local);
  }

  const sanitized = sanitizeTypeName(local);
  if (state.generatedEnums.has(sanitized)) {
    return sanitized;
  }

  if (state.schemaContext.simpleTypesMap.has(local)) {
    const st = state.schemaContext.simpleTypesMap.get(local)!;
    const restriction = getChildByLocalName(st, "restriction", state.xsdPrefix);
    if (restriction) {
      const base = restriction.getAttribute("base");
      if (base) {
        return resolveType(base, state);
      }
    }
    return "String";
  }

  const result = typeMapping(typeAttr);
  return result;
}

/**
 * Converts a candidate name to a valid TypeScript class name.
 *
 * Sanitizes invalid characters, ensures the name starts with a valid character,
 * and appends an underscore if the name conflicts with reserved words.
 *
 * @param candidate - The raw name to convert
 * @param reservedWords - Set of reserved JavaScript/TypeScript keywords
 * @returns A valid TypeScript class name
 */
export function toClassName(
  candidate: string,
  reservedWords: Set<string>
): string {
  let className = candidate
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/^[^A-Za-z_]+/, "");

  if (reservedWords.has(className)) {
    className = className + "_";
  }

  return className;
}

/**
 * Converts a candidate name to a valid TypeScript property name.
 *
 * Similar to toClassName but allows $ in names (valid for properties).
 * Sanitizes invalid characters and appends an underscore for reserved words.
 *
 * @param candidate - The raw name to convert
 * @param reservedWords - Set of reserved JavaScript/TypeScript keywords
 * @returns A valid TypeScript property name
 */
export function toPropertyName(
  candidate: string,
  reservedWords: Set<string>
): string {
  let propName = candidate
    .replace(/[^A-Za-z0-9_$]/g, "_")
    .replace(/^[^A-Za-z_$]+/, "");

  if (reservedWords.has(propName)) {
    propName = propName + "_";
  }

  return propName;
}
