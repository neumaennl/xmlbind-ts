import { XmlElement, XmlRoot, marshal, unmarshal } from "../src/index.js";

class Shelf {
  @XmlElement("label", { type: String, array: true })
  labels?: string[];
}

@XmlRoot("Library")
class Library {
  @XmlElement("book", { type: String, array: true })
  books?: string[];

  @XmlElement("shelf", { type: Shelf })
  shelf?: Shelf;
}

describe("array fields with a single XML occurrence", () => {
  test("returns arrays for root and nested array fields", () => {
    const library = unmarshal(
      Library,
      "<Library><book>One</book><shelf><label>Top</label></shelf></Library>"
    );

    expect(library.books).toEqual(["One"]);
    expect(library.shelf?.labels).toEqual(["Top"]);
  });

  test("returns empty arrays for missing fields and null items for nil occurrences", () => {
    const library = unmarshal(
      Library,
      '<Library xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><book xsi:nil="true"/><shelf><label xsi:nil="true"/></shelf></Library>'
    );

    expect(library.books).toEqual([null]);
    expect(library.shelf?.labels).toEqual([null]);

    const emptyLibrary = unmarshal(Library, "<Library><shelf/></Library>");
    expect(emptyLibrary.books).toEqual([]);
    expect(emptyLibrary.shelf?.labels).toEqual([]);

    const emptyRoot = unmarshal(Library, "<Library/>");
    expect(emptyRoot.books).toEqual([]);
  });

  test("marshals a one-item array as a single XML occurrence", () => {
    const library = new Library();
    library.books = ["One"];

    expect(marshal(library)).toBe("<Library>\n  <book>One</book>\n</Library>\n");
  });
});
