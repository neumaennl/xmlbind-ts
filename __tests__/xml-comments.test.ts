import { unmarshal, marshal } from "../src/marshalling";
import { XmlRoot, XmlElement } from "../src/decorators";

describe("XML Comments Preservation (Metadata Approach)", () => {
  test("should preserve XML comments in unmarshal/marshal roundtrip", () => {
    @XmlRoot("Document")
    class Document {
      @XmlElement("Title")
      title?: string;

      @XmlElement("Content")
      content?: string;
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

    // Verify the comments were captured in metadata
    expect((doc as any)._comments).toBeDefined();
    expect((doc as any)._comments).toHaveLength(3);
    // Comments now have position information
    expect((doc as any)._comments[0].text).toBe(" This is a comment about the title ");
    expect((doc as any)._comments[1].text).toBe(" This is a comment about the content ");
    expect((doc as any)._comments[2].text).toBe(" Final comment ");

    // Verify the data is correct
    expect(doc.title).toBe("My Document");
    expect(doc.content).toBe("Some content here");

    // Marshal back to XML
    const marshalledXml = marshal(doc);

    // Verify comments are in the output AT THE CORRECT POSITIONS
    expect(marshalledXml).toContain("<!-- This is a comment about the title -->");
    expect(marshalledXml).toContain("<!-- This is a comment about the content -->");
    expect(marshalledXml).toContain("<!-- Final comment -->");
    
    // Verify positioning: comment about title should come before Title element
    const titlePos = marshalledXml.indexOf("<Title>");
    const titleCommentPos = marshalledXml.indexOf("<!-- This is a comment about the title -->");
    expect(titleCommentPos).toBeLessThan(titlePos);
    
    // Comment about content should come before Content element  
    const contentPos = marshalledXml.indexOf("<Content>");
    const contentCommentPos = marshalledXml.indexOf("<!-- This is a comment about the content -->");
    expect(contentCommentPos).toBeLessThan(contentPos);

    // Verify data is still correct
    expect(marshalledXml).toContain("<Title>My Document</Title>");
    expect(marshalledXml).toContain("<Content>Some content here</Content>");

    // Do a second roundtrip to ensure stability
    const doc2 = unmarshal(Document, marshalledXml);
    expect((doc2 as any)._comments).toEqual((doc as any)._comments);
    expect(doc2.title).toBe(doc.title);
    expect(doc2.content).toBe(doc.content);
  });

  test("should work without comments when they don't exist", () => {
    @XmlRoot("SimpleDoc")
    class SimpleDoc {
      @XmlElement("Title")
      title?: string;
    }

    const xmlWithoutComments = `<SimpleDoc>
  <Title>Test</Title>
</SimpleDoc>`;

    const doc = unmarshal(SimpleDoc, xmlWithoutComments);
    expect(doc.title).toBe("Test");
    expect((doc as any)._comments).toBeUndefined();

    const marshalled = marshal(doc);
    expect(marshalled).toContain("<Title>Test</Title>");
    expect(marshalled).not.toContain("<!--");
  });

  test("should handle single comment", () => {
    @XmlRoot("Doc")
    class Doc {
      @XmlElement("Title")
      title?: string;
    }

    const xml = `<Doc>
  <!-- Single comment -->
  <Title>Test</Title>
</Doc>`;

    const doc = unmarshal(Doc, xml);
    expect((doc as any)._comments).toBeDefined();
    expect((doc as any)._comments).toHaveLength(1);
    expect((doc as any)._comments[0].text).toBe(" Single comment ");

    const marshalled = marshal(doc);
    expect(marshalled).toContain("<!-- Single comment -->");
  });

  test("should preserve comments in nested elements", () => {
    @XmlRoot("Section")
    class Section {
      @XmlElement("Title")
      title?: string;
    }

    @XmlRoot("Root")
    class Root {
      @XmlElement("Section", { type: Section })
      section?: Section;
    }

    const xml = `<Root>
  <!-- Root comment -->
  <Section>
    <!-- Section comment -->
    <Title>Section Title</Title>
  </Section>
</Root>`;

    const root = unmarshal(Root, xml);
    
    // Root level comments
    expect((root as any)._comments).toBeDefined();
    expect((root as any)._comments).toHaveLength(1);
    expect((root as any)._comments[0].text).toBe(" Root comment ");

    // Section level comments - NOW IMPLEMENTED
    expect((root.section as any)._comments).toBeDefined();
    expect((root.section as any)._comments).toHaveLength(1);
    expect((root.section as any)._comments[0].text).toBe(" Section comment ");

    // Marshal back
    const marshalled = marshal(root);
    
    // Verify all comments are preserved
    expect(marshalled).toContain("<!-- Root comment -->");
    expect(marshalled).toContain("<!-- Section comment -->");

    // Roundtrip verification - compare data and comments separately
    const root2 = unmarshal(Root, marshalled);
    expect(root2.section?.title).toBe(root.section?.title);
    expect((root2 as any)._comments).toEqual((root as any)._comments);
    expect((root2.section as any)._comments).toEqual((root.section as any)._comments);
  });
});
