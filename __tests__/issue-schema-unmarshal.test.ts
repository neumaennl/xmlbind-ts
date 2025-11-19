import { mkdtempSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { generateFromXsd } from "../src/xsd/TsGenerator";

describe("Schema Unmarshalling Issue - Nested Compositors", () => {
  test("generates elements from nested sequence and choice compositors", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "nested-compositor-test-"));

    try {
      // Create a schema with nested compositors (sequence inside sequence, choice inside sequence)
      const testSchema = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="root">
    <xs:complexType>
      <xs:sequence>
        <xs:choice minOccurs="0" maxOccurs="unbounded">
          <xs:element name="optionA" type="xs:string"/>
          <xs:element name="optionB" type="xs:int"/>
        </xs:choice>
        <xs:sequence minOccurs="0">
          <xs:element name="nested1" type="xs:string"/>
          <xs:element name="nested2" type="xs:int"/>
        </xs:sequence>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

      // Generate TypeScript classes
      generateFromXsd(testSchema, tmpDir);

      // Read the generated root.ts file
      const rootTsPath = join(tmpDir, "root.ts");
      const rootTsContent = readFileSync(rootTsPath, "utf-8");

      // Verify that all elements are present
      expect(rootTsContent).toContain("@XmlElement('optionA'");
      expect(rootTsContent).toContain("@XmlElement('optionB'");
      expect(rootTsContent).toContain("@XmlElement('nested1'");
      expect(rootTsContent).toContain("@XmlElement('nested2'");

      // Verify that optionA and optionB are optional (inside choice)
      expect(rootTsContent).toMatch(/optionA\?:/);
      expect(rootTsContent).toMatch(/optionB\?:/);

      // Verify that nested1 and nested2 exist (they might be required or optional)
      expect(rootTsContent).toMatch(/nested1[!?]:/);
      expect(rootTsContent).toMatch(/nested2[!?]:/);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("generates elements from XMLSchema.xsd with complex nested structure", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "xmlschema-test-"));

    try {
      // Read the XMLSchema.xsd (the schema that defines XSD schemas)
      const xmlSchemaXsd = readFileSync(
        join(__dirname, "test-resources/XMLSchema.xsd"),
        "utf-8"
      );

      // Generate TypeScript classes from XMLSchema.xsd
      generateFromXsd(xmlSchemaXsd, tmpDir);

      // Read the generated schema.ts file
      const schemaTsPath = join(tmpDir, "schema.ts");
      const schemaTsContent = readFileSync(schemaTsPath, "utf-8");

      // Verify that key elements from nested compositors are present
      // These come from the choice inside the outer sequence
      expect(schemaTsContent).toContain("@XmlElement('include'");
      expect(schemaTsContent).toContain("@XmlElement('import'");
      expect(schemaTsContent).toContain("@XmlElement('redefine'");

      // These come from the schemaTop group reference inside the inner sequence
      expect(schemaTsContent).toContain("@XmlElement('simpleType'");
      expect(schemaTsContent).toContain("@XmlElement('complexType'");
      expect(schemaTsContent).toContain("@XmlElement('element'");
      expect(schemaTsContent).toContain("@XmlElement('attribute'");

      // Verify that the class extends openAttrs
      expect(schemaTsContent).toContain("extends openAttrs");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
