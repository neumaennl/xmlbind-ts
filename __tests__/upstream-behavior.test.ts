import { element, text, writeXml } from "../src/marshalling/xmlTree.js";

/**
 * Pins problems of dependencies that xmlbind-ts works around or documents.
 * A test here fails when a dependency fixes its problem; the known issue
 * named in the test then says what to remove or update.
 */
describe("Upstream behavior", () => {
  // Upstream: fast-xml-builder#30, see known issues
  test("fast-xml-builder starts the output with a line break and ends it without one (fast-xml-builder#30); when this fails, follow the known issue", () => {
    expect(writeXml([element("r")])).toBe("\n<r/>");
  });

  // Upstream: fast-xml-builder#31, see known issues
  test("fast-xml-builder writes a whitespace-only line in mixed content that starts with a tag (fast-xml-builder#31); when this fails, follow the known issue", () => {
    const xml = writeXml([element("p", [element("b", [text("two")]), text("three")])]);

    expect(xml).toBe("\n<p>\n  \n  <b>two</b>\n  three\n</p>");
  });

  // Upstream: fast-xml-parser#902, see known issues
  test("fast-xml-builder writes characters that XML does not allow (fast-xml-parser#902); when this fails, follow the known issue", () => {
    expect(writeXml([element("r", [text("a\u0000b")])])).toBe("\n<r>a\u0000b</r>");
  });
});
