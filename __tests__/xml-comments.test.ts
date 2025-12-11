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
    expect(titleCommentPos).toBeGreaterThan(0); // Comment should exist
    
    // Comment about content should come AFTER Title and BEFORE Content element  
    const contentPos = marshalledXml.indexOf("<Content>");
    const contentCommentPos = marshalledXml.indexOf("<!-- This is a comment about the content -->");
    expect(contentCommentPos).toBeLessThan(contentPos);
    expect(contentCommentPos).toBeGreaterThan(titlePos); // After title element
    
    // Final comment should come AFTER Content element
    const finalCommentPos = marshalledXml.indexOf("<!-- Final comment -->");
    expect(finalCommentPos).toBeGreaterThan(contentPos); // After content element

    // Verify data is still correct
    expect(marshalledXml).toContain("<Title>My Document</Title>");
    expect(marshalledXml).toContain("<Content>Some content here</Content>");
    
    // Verify the overall structure matches the input by checking element order
    const docOpenPos = marshalledXml.indexOf("<Document>");
    const docClosePos = marshalledXml.indexOf("</Document>");
    expect(titleCommentPos).toBeGreaterThan(docOpenPos);
    expect(titleCommentPos).toBeLessThan(docClosePos);
    expect(titlePos).toBeLessThan(contentCommentPos);
    expect(contentPos).toBeLessThan(finalCommentPos);
    expect(finalCommentPos).toBeLessThan(docClosePos);

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
    
    // Verify positioning: Root comment should come BEFORE Section element
    const sectionOpenPos = marshalled.indexOf("<Section>");
    const rootCommentPos = marshalled.indexOf("<!-- Root comment -->");
    expect(rootCommentPos).toBeLessThan(sectionOpenPos);
    expect(rootCommentPos).toBeGreaterThan(0);
    
    // Section comment should come AFTER Section opening tag but BEFORE Title
    const titlePos = marshalled.indexOf("<Title>");
    const sectionCommentPos = marshalled.indexOf("<!-- Section comment -->");
    expect(sectionCommentPos).toBeGreaterThan(sectionOpenPos);
    expect(sectionCommentPos).toBeLessThan(titlePos);
    
    // Verify the Section comment is inside Section element, not at root level
    const sectionClosePos = marshalled.indexOf("</Section>");
    expect(sectionCommentPos).toBeLessThan(sectionClosePos);

    // Roundtrip verification - compare data and comments separately
    const root2 = unmarshal(Root, marshalled);
    expect(root2.section?.title).toBe(root.section?.title);
    expect((root2 as any)._comments).toEqual((root as any)._comments);
    expect((root2.section as any)._comments).toEqual((root.section as any)._comments);
  });

  test("should preserve exact comment positions by comparing XML structure", () => {
    @XmlRoot("Document")
    class Document {
      @XmlElement("Title")
      title?: string;

      @XmlElement("Content")
      content?: string;
    }

    const originalXml = `<Document>
  <!-- This is a comment about the title -->
  <Title>My Document</Title>
  <!-- This is a comment about the content -->
  <Content>Some content here</Content>
  <!-- Final comment -->
</Document>`;

    // Unmarshal and marshal
    const doc = unmarshal(Document, originalXml);
    const marshalledXml = marshal(doc);
    
    // Extract just the structure (order of tags and comments)
    const extractStructure = (xml: string) => {
      const allMatches: Array<{pos: number, text: string}> = [];
      
      // Find all comments - using new regex instance to avoid state issues
      const commentRegex = /<!--.*?-->/g;
      let commentMatch;
      while ((commentMatch = commentRegex.exec(xml)) !== null) {
        allMatches.push({pos: commentMatch.index, text: commentMatch[0]});
      }
      
      // Find all elements (excluding comments with negative lookahead)
      const elementRegex = /<\/?(?!--)[^>]+>/g;
      let elementMatch;
      while ((elementMatch = elementRegex.exec(xml)) !== null) {
        allMatches.push({pos: elementMatch.index, text: elementMatch[0]});
      }
      
      // Sort by position
      allMatches.sort((a, b) => a.pos - b.pos);
      
      return allMatches.map(m => m.text);
    };

    const marshalledStructure = extractStructure(marshalledXml);

    // Check relative ordering of comments and opening tags
    // We check opening tags since closing tags always come after
    const titleOpenIdx = marshalledStructure.findIndex(s => s === '<Title>');
    const contentOpenIdx = marshalledStructure.findIndex(s => s === '<Content>');
    const comment1Idx = marshalledStructure.findIndex(s => s.includes('comment about the title'));
    const comment2Idx = marshalledStructure.findIndex(s => s.includes('comment about the content'));
    const comment3Idx = marshalledStructure.findIndex(s => s.includes('Final comment'));

    // Verify all indices were found
    expect(titleOpenIdx).toBeGreaterThanOrEqual(0);
    expect(contentOpenIdx).toBeGreaterThanOrEqual(0);
    expect(comment1Idx).toBeGreaterThanOrEqual(0);
    expect(comment2Idx).toBeGreaterThanOrEqual(0);
    expect(comment3Idx).toBeGreaterThanOrEqual(0);

    // Verify: comment1 < Title < comment2 < Content < comment3
    // This ensures comments maintain their position relative to the elements they document
    expect(comment1Idx).toBeLessThan(titleOpenIdx);
    expect(titleOpenIdx).toBeLessThan(comment2Idx);
    expect(comment2Idx).toBeLessThan(contentOpenIdx);
    expect(contentOpenIdx).toBeLessThan(comment3Idx);
  });
});
