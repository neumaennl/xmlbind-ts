import { generateFromXsd } from "../src/xsd/TsGenerator";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

function withTmpDir(fn: (dir: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xmlbind-attrgroups-"));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("XSD Generator - Attribute Groups", () => {
  test("generates classes with attribute group references", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:attributeGroup name="CommonAttributes">
    <xs:attribute name="id" type="xs:ID"/>
    <xs:attribute name="version" type="xs:string"/>
    <xs:attribute name="createdDate" type="xs:date"/>
  </xs:attributeGroup>
  
  <xs:complexType name="Document">
    <xs:sequence>
      <xs:element name="title" type="xs:string"/>
      <xs:element name="content" type="xs:string"/>
    </xs:sequence>
    <xs:attributeGroup ref="CommonAttributes"/>
    <xs:attribute name="status" type="xs:string"/>
  </xs:complexType>
  
  <xs:element name="Document" type="Document"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      const docFile = path.join(dir, "Document.ts");
      expect(fs.existsSync(docFile)).toBe(true);

      const content = fs.readFileSync(docFile, "utf-8");

      // Should have all attributes from the group
      expect(content).toContain("@XmlAttribute('id')");
      expect(content).toContain("@XmlAttribute('version')");
      expect(content).toContain("@XmlAttribute('createdDate')");
      expect(content).toContain("@XmlAttribute('status')");

      // Should have properties
      expect(content).toContain("id?:");
      expect(content).toContain("version?:");
      expect(content).toContain("createdDate?:");
      expect(content).toContain("status?:");
    });
  });

  test("handles multiple attribute groups", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:attributeGroup name="IdentityAttributes">
    <xs:attribute name="id" type="xs:ID"/>
    <xs:attribute name="name" type="xs:string"/>
  </xs:attributeGroup>
  
  <xs:attributeGroup name="AuditAttributes">
    <xs:attribute name="createdBy" type="xs:string"/>
    <xs:attribute name="modifiedBy" type="xs:string"/>
  </xs:attributeGroup>
  
  <xs:complexType name="Entity">
    <xs:sequence>
      <xs:element name="data" type="xs:string"/>
    </xs:sequence>
    <xs:attributeGroup ref="IdentityAttributes"/>
    <xs:attributeGroup ref="AuditAttributes"/>
  </xs:complexType>
  
  <xs:element name="Entity" type="Entity"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      const entityFile = path.join(dir, "Entity.ts");
      expect(fs.existsSync(entityFile)).toBe(true);

      const content = fs.readFileSync(entityFile, "utf-8");

      // Should have attributes from both groups
      expect(content).toContain("@XmlAttribute('id')");
      expect(content).toContain("@XmlAttribute('name')");
      expect(content).toContain("@XmlAttribute('createdBy')");
      expect(content).toContain("@XmlAttribute('modifiedBy')");
    });
  });
});
