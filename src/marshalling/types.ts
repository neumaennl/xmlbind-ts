/**
 * Represents a parsed XML node from fast-xml-parser.
 * Contains element children, attributes (prefixed with @_), and optional text content.
 */
export interface ParsedXmlNode {
  [key: string]: ParsedXmlValue;
  "@_xsi:nil"?: "true";
  "#text"?: string;
}

/**
 * Represents any possible value in a parsed XML structure.
 * Can be a primitive value, an object node, or an array of nodes.
 */
export type ParsedXmlValue =
  | string
  | number
  | boolean
  | ParsedXmlNode
  | ParsedXmlNode[]
  | undefined;

/**
 * Constructor type for primitive TypeScript types used in XML marshalling.
 */
export type PrimitiveConstructor =
  | typeof String
  | typeof Number
  | typeof Boolean
  | typeof Date;

/**
 * Type guard to check if a constructor function represents a primitive type.
 *
 * @param fn - The value to check
 * @returns True if fn is a primitive constructor (String, Number, Boolean, or Date)
 */
export function isPrimitiveCtor(fn: unknown): fn is PrimitiveConstructor {
  return fn === String || fn === Number || fn === Boolean || fn === Date;
}

/**
 * Type guard to check if a value is a parsed XML node object.
 *
 * @param value - The value to check
 * @returns True if the value is a non-null object (potential XML node)
 */
export function isParsedXmlNode(value: unknown): value is ParsedXmlNode {
  return value !== null && typeof value === "object";
}
