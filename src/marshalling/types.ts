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

export function isParsedXmlNode(value: unknown): value is ParsedXmlNode {
  return value !== null && typeof value === "object";
}
