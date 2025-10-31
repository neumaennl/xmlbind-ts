/**
 * Represents a parsed XML node from fast-xml-parser
 */
export interface ParsedXmlNode {
  [key: string]: ParsedXmlValue;
  "@_xsi:nil"?: "true";
  "#text"?: string;
}

export type ParsedXmlValue =
  | string
  | number
  | boolean
  | ParsedXmlNode
  | ParsedXmlNode[]
  | undefined;

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

export function isParsedXmlNode(value: unknown): value is ParsedXmlNode {
  return value !== null && typeof value === "object";
}
