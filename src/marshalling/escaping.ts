/**
 * The characters that `marshal()` escapes in element text and attribute
 * values. A carriage return is written as a character reference, because a
 * parser turns a literal one into a line feed. Line feeds and tabs in
 * attribute values are written as they are, so that a line break in the
 * source keeps its meaning; a parser reads them as spaces.
 */
const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
  "\r": "&#13;",
};

const ESCAPE_PATTERN = /[&<>"'\r]/g;

/**
 * Escapes element text or an attribute value for the XML builder, which
 * passes it as `tagValueProcessor` and `attributeValueProcessor`.
 *
 * @param _name - The name of the element or attribute, which the builder passes
 * @param value - The value; values other than strings are returned unchanged
 * @returns The escaped value
 */
export function escapeValue(_name: string, value: unknown): unknown {
  return typeof value === "string"
    ? value.replace(ESCAPE_PATTERN, (c) => ESCAPES[c])
    : value;
}
