/**
 * Helpers for working with the lines of a text.
 */

/**
 * Returns the first line of a text that is not empty, such as the line with
 * the start tag of the root element in the output of `marshal()`, which
 * starts with a line break (Upstream: fast-xml-builder#30, see known issues).
 *
 * @param text - The multi-line text
 * @returns The first non-empty line, or an empty string if there is none
 *
 * @example
 * ```typescript
 * firstLine('\n<Task id="2">\n</Task>'); // '<Task id="2">'
 * ```
 */
export function firstLine(text: string): string {
  return text.split("\n").find((line) => line.trim() !== "") ?? "";
}
