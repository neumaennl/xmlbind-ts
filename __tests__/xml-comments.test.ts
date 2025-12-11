import { unmarshal, marshal } from "../src/marshalling";
import { XmlRoot, XmlElement, XmlComments, XmlAttribute } from "../src/decorators";

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

  test("should preserve comments in nested elements", () => {
    @XmlRoot("Section")
    class Section {
      @XmlAttribute("name")
      name?: string;

      @XmlElement("Title")
      title?: string;

      @XmlComments()
      comments?: string[];
    }

    @XmlRoot("Root")
    class Root {
      @XmlElement("Section", { type: Section, array: true })
      sections?: Section[];

      @XmlComments()
      comments?: string[];
    }

    const xml = `<Root>
  <!-- Root level comment -->
  <Section name="first">
    <!-- Section comment 1 -->
    <Title>First Section</Title>
    <!-- Section comment 2 -->
  </Section>
  <Section name="second">
    <!-- Another section comment -->
    <Title>Second Section</Title>
  </Section>
  <!-- Final root comment -->
</Root>`;

    const root = unmarshal(Root, xml);
    
    // Root level comments
    expect(root.comments).toBeDefined();
    expect(root.comments).toHaveLength(2);
    expect(root.comments).toContain(" Root level comment ");
    expect(root.comments).toContain(" Final root comment ");

    // Section level comments
    expect(root.sections).toHaveLength(2);
    expect(root.sections![0].comments).toBeDefined();
    expect(root.sections![0].comments).toHaveLength(2);
    expect(root.sections![0].comments).toContain(" Section comment 1 ");
    expect(root.sections![0].comments).toContain(" Section comment 2 ");
    
    expect(root.sections![1].comments).toBeDefined();
    expect(root.sections![1].comments).toHaveLength(1);
    expect(root.sections![1].comments).toContain(" Another section comment ");

    // Marshal back
    const marshalled = marshal(root);
    
    // Verify all comments are preserved
    expect(marshalled).toContain("<!-- Root level comment -->");
    expect(marshalled).toContain("<!-- Final root comment -->");
    expect(marshalled).toContain("<!-- Section comment 1 -->");
    expect(marshalled).toContain("<!-- Section comment 2 -->");
    expect(marshalled).toContain("<!-- Another section comment -->");

    // Roundtrip verification
    const root2 = unmarshal(Root, marshalled);
    expect(JSON.stringify(root2)).toBe(JSON.stringify(root));
  });

  test("should handle single comment (not array)", () => {
    @XmlRoot("Doc")
    class Doc {
      @XmlElement("Title")
      title?: string;

      @XmlComments()
      comments?: string[];
    }

    const xml = `<Doc>
  <!-- Single comment -->
  <Title>Test</Title>
</Doc>`;

    const doc = unmarshal(Doc, xml);
    expect(doc.comments).toBeDefined();
    expect(doc.comments).toHaveLength(1);
    expect(doc.comments![0]).toBe(" Single comment ");

    const marshalled = marshal(doc);
    expect(marshalled).toContain("<!-- Single comment -->");
  });

  test("should preserve comment content exactly including whitespace", () => {
    @XmlRoot("Doc")
    class Doc {
      @XmlElement("Data")
      data?: string;

      @XmlComments()
      comments?: string[];
    }

    const xml = `<Doc>
  <!--   This has extra   spaces   -->
  <Data>value</Data>
  <!--
    Multi-line
    comment
  -->
</Doc>`;

    const doc = unmarshal(Doc, xml);
    expect(doc.comments).toBeDefined();
    expect(doc.comments).toHaveLength(2);
    expect(doc.comments![0]).toBe("   This has extra   spaces   ");
    expect(doc.comments![1]).toContain("Multi-line");
    expect(doc.comments![1]).toContain("comment");

    const marshalled = marshal(doc);
    expect(marshalled).toContain("<!--   This has extra   spaces   -->");
  });
});
