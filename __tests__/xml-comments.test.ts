import { unmarshal, marshal } from "../src/marshalling";
import { XmlRoot, XmlElement, XmlComments } from "../src/decorators";

describe("XML Comments Preservation", () => {
  test("should preserve XML comments in unmarshal/marshal roundtrip", () => {
    @XmlRoot("Document")
    class Document {
      @XmlElement("Title")
      title?: string;

      @XmlElement("Content")
      content?: string;

      @XmlComments()
      comments?: string[];
    }

    const xmlWithComments = `<Document>
  <!-- This is a comment about the title -->
  <Title>My Document</Title>
  <!-- This is a comment about the content -->
  <Content>Some content here</Content>
  <!-- Final comment -->
</Document>`;

    // Unmarshal the XML
    const doc = unmarshal(Document, xmlWithComments);

    // Verify the comments were captured
    expect(doc.comments).toBeDefined();
    expect(doc.comments).toHaveLength(3);
    expect(doc.comments).toContain(" This is a comment about the title ");
    expect(doc.comments).toContain(" This is a comment about the content ");
    expect(doc.comments).toContain(" Final comment ");

    // Verify the data is correct
    expect(doc.title).toBe("My Document");
    expect(doc.content).toBe("Some content here");

    // Marshal back to XML
    const marshalledXml = marshal(doc);

    // Verify comments are in the output
    expect(marshalledXml).toContain("<!-- This is a comment about the title -->");
    expect(marshalledXml).toContain("<!-- This is a comment about the content -->");
    expect(marshalledXml).toContain("<!-- Final comment -->");

    // Verify data is still correct
    expect(marshalledXml).toContain("<Title>My Document</Title>");
    expect(marshalledXml).toContain("<Content>Some content here</Content>");

    // Do a second roundtrip to ensure stability
    const doc2 = unmarshal(Document, marshalledXml);
    expect(doc2.comments).toEqual(doc.comments);
    expect(doc2.title).toBe(doc.title);
    expect(doc2.content).toBe(doc.content);
  });

  test("should work without comments when decorator is not used", () => {
    @XmlRoot("SimpleDoc")
    class SimpleDoc {
      @XmlElement("Title")
      title?: string;
    }

    const xmlWithComments = `<SimpleDoc>
  <!-- This comment will be ignored -->
  <Title>Test</Title>
</SimpleDoc>`;

    const doc = unmarshal(SimpleDoc, xmlWithComments);
    expect(doc.title).toBe("Test");
    expect((doc as any).comments).toBeUndefined();

    const marshalled = marshal(doc);
    expect(marshalled).toContain("<Title>Test</Title>");
    // Comments should not be in the output since no @XmlComments decorator
    expect(marshalled).not.toContain("<!--");
  });

  test("should handle empty comments array", () => {
    @XmlRoot("Doc")
    class Doc {
      @XmlElement("Title")
      title?: string;

      @XmlComments()
      comments?: string[];
    }

    const xmlWithoutComments = `<Doc>
  <Title>Test</Title>
</Doc>`;

    const doc = unmarshal(Doc, xmlWithoutComments);
    expect(doc.title).toBe("Test");
    expect(doc.comments).toBeUndefined();

    const marshalled = marshal(doc);
    expect(marshalled).toContain("<Title>Test</Title>");
    expect(marshalled).not.toContain("<!--");
  });

  test("should preserve comments in complex nested structures", () => {
    @XmlRoot("Root")
    class Root {
      @XmlElement("Item")
      items?: string[];

      @XmlComments()
      comments?: string[];
    }

    const xml = `<Root>
  <!-- First comment -->
  <Item>Item 1</Item>
  <!-- Second comment -->
  <Item>Item 2</Item>
  <!-- Third comment -->
  <Item>Item 3</Item>
  <!-- Final comment -->
</Root>`;

    const root = unmarshal(Root, xml);
    expect(root.items).toEqual(["Item 1", "Item 2", "Item 3"]);
    expect(root.comments).toHaveLength(4);

    const marshalled = marshal(root);
    expect(marshalled).toContain("<!-- First comment -->");
    expect(marshalled).toContain("<!-- Second comment -->");
    expect(marshalled).toContain("<!-- Third comment -->");
    expect(marshalled).toContain("<!-- Final comment -->");
  });
});
