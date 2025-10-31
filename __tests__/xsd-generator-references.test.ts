import { generateFromXsd } from "../src/xsd/TsGenerator";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

function withTmpDir(fn: (dir: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xmlbind-refs-"));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("XSD Generator - Element and Attribute References", () => {
  test("handles element references", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:element name="Title" type="xs:string"/>
  
  <xs:complexType name="Document">
    <xs:sequence>
      <xs:element ref="Title"/>
      <xs:element name="content" type="xs:string"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:element name="Doc" type="Document"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      const docFile = path.join(dir, "Document.ts");
      expect(fs.existsSync(docFile)).toBe(true);

      const content = fs.readFileSync(docFile, "utf-8");

      // Should have the referenced element
      expect(content).toContain("@XmlElement('Title'");
      expect(content).toContain("Title?: String");

      // And the direct element
      expect(content).toContain("@XmlElement('content'");
      expect(content).toContain("content?: String");
    });
  });

  test("handles attribute references", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:attribute name="version" type="xs:string"/>
  
  <xs:complexType name="Document">
    <xs:sequence>
      <xs:element name="content" type="xs:string"/>
    </xs:sequence>
    <xs:attribute ref="version"/>
    <xs:attribute name="status" type="xs:string"/>
  </xs:complexType>
  
  <xs:element name="Doc" type="Document"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      const docFile = path.join(dir, "Document.ts");
      expect(fs.existsSync(docFile)).toBe(true);

      const content = fs.readFileSync(docFile, "utf-8");

      // Should have the referenced attribute
      expect(content).toContain("@XmlAttribute('version'");
      expect(content).toContain("version?: String");

      // And the direct attribute
      expect(content).toContain("@XmlAttribute('status'");
      expect(content).toContain("status?: String");
    });
  });

  test("handles element reference with maxOccurs", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:element name="Item" type="xs:string"/>
  
  <xs:complexType name="List">
    <xs:sequence>
      <xs:element ref="Item" maxOccurs="unbounded"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:element name="ItemList" type="List"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      const listFile = path.join(dir, "List.ts");
      const content = fs.readFileSync(listFile, "utf-8");

      // Should generate an array
      expect(content).toContain("Item?: String[]");
      expect(content).toContain("array: true");
    });
  });
});
