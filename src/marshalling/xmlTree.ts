/**
 * The tree that `marshal()` builds and writes with `fast-xml-builder` in its
 * ordered mode (`preserveOrder: true`). Each entry is an object with one key:
 * the name of an element with the array of its children, `#text` with a
 * text value, `#comment` with the comment, or `?xml` for the XML
 * declaration. The attributes of an element are under `:@`, without a
 * prefix.
 */
import XMLBuilder from "fast-xml-builder";
import { escapeValue } from "./escaping.js";

/** A value that the builder writes as text. */
export type XmlValue = string | number | boolean;

/** The attributes of an element, by name, without a prefix. */
export type XmlAttributes = Record<string, XmlValue>;

/** An entry of the ordered tree: an element, a text, a comment or the XML declaration. */
export interface XmlEntry {
  [name: string]: XmlEntry[] | XmlValue | XmlAttributes;
}

const TEXT = "#text";
const COMMENT = "#comment";
const ATTRIBUTES = ":@";
/** The prefix of attribute names in the keyed format of the parser. */
const KEYED_ATTRIBUTE_PREFIX = "@_";

const builder = new XMLBuilder({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: TEXT,
  commentPropName: COMMENT,
  format: true,
  indentBy: "  ",
  suppressBooleanAttributes: false, // Preserve boolean attribute values like mixed="true"
  suppressEmptyNode: true, // Use self-closing tags for empty elements
  processEntities: false, // The value processors escape instead
  tagValueProcessor: escapeValue,
  attributeValueProcessor: escapeValue,
});

/**
 * Creates an element entry. The attributes are kept by reference, so that
 * attributes added to the object later, such as namespace declarations on
 * the root element, are written as well.
 *
 * @param name - The qualified name of the element
 * @param children - The child entries
 * @param attributes - The attributes; the entry gets none if omitted
 * @returns The element entry
 */
export function element(
  name: string,
  children: XmlEntry[] = [],
  attributes?: XmlAttributes
): XmlEntry {
  const entry: XmlEntry = { [name]: children };
  if (attributes) entry[ATTRIBUTES] = attributes;
  return entry;
}

/**
 * Creates a text entry. The builder escapes the text when it writes it.
 *
 * @param value - The text
 * @returns The text entry
 */
export function text(value: XmlValue): XmlEntry {
  return { [TEXT]: value };
}

/**
 * Creates a comment entry. Its text is written as it is, because XML does
 * not recognize references in comments.
 *
 * @param value - The text between `<!--` and `-->`
 * @returns The comment entry
 * @throws {Error} If the text contains `--` or ends with `-`, which XML does not allow in a comment
 */
export function comment(value: string): XmlEntry {
  if (value.includes("--") || value.endsWith("-")) {
    throw new Error(
      `A comment cannot contain "--" or end with "-": ${JSON.stringify(value)}`
    );
  }
  return { [COMMENT]: [text(value)] };
}

/**
 * Creates the entry of the XML declaration `<?xml version="1.0" encoding="UTF-8"?>`.
 *
 * @returns The declaration entry
 */
export function declaration(): XmlEntry {
  return { "?xml": [], [ATTRIBUTES]: { version: "1.0", encoding: "UTF-8" } };
}

/**
 * Converts content in the keyed format of the parser, as stored by wildcard
 * fields, into entries of the ordered tree. An array becomes one element per
 * item, `null` an empty element, and an object an element whose keys with
 * the prefix `@_` are attributes, whose key `#text` is text, and whose other
 * keys are child elements, in the order of the keys. `undefined` values are
 * left out.
 *
 * @param name - The name of the element
 * @param value - The content of the element in the keyed format
 * @returns The element entries
 * @throws {Error} If the name starts with `@_` or is `#text`, which mark attributes and text in the keyed format
 * @example
 * ```typescript
 * fromKeyed("a", { "@_x": "1", b: ["2", "3"] });
 * // [{ a: [{ b: [{ "#text": "2" }] }, { b: [{ "#text": "3" }] }], ":@": { x: "1" } }]
 * ```
 */
export function fromKeyed(name: string, value: unknown): XmlEntry[] {
  if (name.startsWith(KEYED_ATTRIBUTE_PREFIX) || name === TEXT) {
    throw new Error(
      `An element cannot be named ${JSON.stringify(name)}: in the keyed format, "@_" marks attributes and "#text" marks text`
    );
  }
  if (value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap((item) => fromKeyed(name, item));
  if (value === null) return [element(name)];
  if (typeof value !== "object") return [element(name, [text(toXmlValue(value))])];

  const children: XmlEntry[] = [];
  const attributes: XmlAttributes = {};
  for (const [key, content] of Object.entries(value)) {
    if (content === undefined) continue;
    if (key.startsWith(KEYED_ATTRIBUTE_PREFIX)) {
      attributes[key.slice(KEYED_ATTRIBUTE_PREFIX.length)] = toXmlValue(content);
    } else if (key === TEXT) {
      children.push(text(toXmlValue(content)));
    } else {
      children.push(...fromKeyed(key, content));
    }
  }
  return [
    element(name, children, Object.keys(attributes).length > 0 ? attributes : undefined),
  ];
}

/**
 * Keeps strings, numbers and booleans as they are and converts other values
 * with `String()`.
 *
 * @param value - The value
 * @returns The value the builder can write
 */
function toXmlValue(value: unknown): XmlValue {
  return typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
    ? value
    : String(value);
}

/**
 * Writes the entries as an XML string, indented by two spaces. Every
 * top-level entry except the XML declaration starts with a line break, and
 * the output does not end with one (Upstream: fast-xml-builder#30, see known
 * issues). Mixed content that starts with a tag gets a whitespace-only line
 * (Upstream: fast-xml-builder#31, see known issues).
 *
 * @param entries - The top-level entries: the declaration, comments and the root element
 * @returns The XML string
 */
export function writeXml(entries: XmlEntry[]): string {
  return builder.build(entries);
}
