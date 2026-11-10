import {
  comment,
  declaration,
  element,
  fromKeyed,
  text,
  writeXml,
  type XmlAttributes,
} from "../src/marshalling/xmlTree.js";

describe("XML tree", () => {
  test("writes elements, attributes and text, and escapes text and attribute values", () => {
    const xml = writeXml([
      element("r", [element("a", [text(`<a & "b">`)]), element("b")], { x: "<&>" }),
    ]);

    expect(xml).toBe(
      `\n<r x="&lt;&amp;&gt;">\n  <a>&lt;a &amp; &quot;b&quot;&gt;</a>\n  <b/>\n</r>`
    );
  });

  test("writes attributes that are added after the element was created", () => {
    const attributes: XmlAttributes = {};
    const root = element("r", [], attributes);
    attributes["xmlns:p"] = "urn:p";

    expect(writeXml([root])).toBe(`\n<r xmlns:p="urn:p"/>`);
  });

  test("writes the declaration and comments before the root element", () => {
    const xml = writeXml([declaration(), comment(" c "), element("r")]);

    expect(xml).toBe(`<?xml version="1.0" encoding="UTF-8"?>\n<!-- c -->\n<r/>`);
  });

  test("writes the text of comments without escaping it", () => {
    const xml = writeXml([element("r", [comment(` a & <b> "c" \r `)])]);

    expect(xml).toBe(`\n<r>\n  <!-- a & <b> "c" \r -->\n</r>`);
  });

  test.each(["a--b", "-->", "a-", "-"])(
    "throws for the comment %j, which XML cannot represent",
    (value) => {
      expect(() => comment(value)).toThrow(/cannot contain "--" or end with "-"/);
    }
  );

  test("accepts a comment that starts with a hyphen and contains single hyphens", () => {
    expect(writeXml([comment("-a-b")])).toBe(`\n<!---a-b-->`);
  });

  describe("fromKeyed", () => {
    test("converts attributes, text and child elements in the order of the keys", () => {
      const entries = fromKeyed("a", { "@_x": "1", b: ["2", 3], "#text": "t", c: { "@_y": true } });

      expect(entries).toEqual([
        element(
          "a",
          [
            element("b", [text("2")]),
            element("b", [text(3)]),
            text("t"),
            element("c", [], { y: true }),
          ],
          { x: "1" }
        ),
      ]);
    });

    test("writes null as an empty element and leaves out undefined", () => {
      const entries = fromKeyed("a", { b: null, c: undefined, "@_d": undefined });

      expect(writeXml(entries)).toBe(`\n<a>\n  <b/>\n</a>`);
    });

    test("converts an array into one element per item", () => {
      expect(fromKeyed("a", ["1", { b: "2" }])).toEqual([
        element("a", [text("1")]),
        element("a", [element("b", [text("2")])]),
      ]);
    });
  });
});
