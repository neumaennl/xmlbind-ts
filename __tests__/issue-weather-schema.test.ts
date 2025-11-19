import { mkdtempSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { generateFromXsd } from "../src/xsd/TsGenerator";

describe("Issue: Weather Schema Unmarshalling", () => {
  test("generates and compiles TypeScript from weather schema with undefined types", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "weather-test-"));

    try {
      // Simplified weather schema that exhibits the issue
      const weatherSchema = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" elementFormDefault="qualified"
  attributeFormDefault="unqualified">
  <xs:element name="weatherdata">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="meta" type="metaType" minOccurs="0" />
        <xs:element name="product" type="productType" minOccurs="0" maxOccurs="unbounded" />
      </xs:sequence>
      <xs:attribute name="created" type="xs:dateTime" use="required" />
    </xs:complexType>
  </xs:element>

  <xs:complexType name="metaType">
    <xs:sequence>
      <xs:element name="model" type="modelType" minOccurs="1" maxOccurs="unbounded" />
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="modelType">
    <xs:attribute name="name" type="xs:string" />
  </xs:complexType>

  <xs:complexType name="productType">
    <xs:sequence>
      <xs:element name="time" type="timeType" maxOccurs="unbounded" />
    </xs:sequence>
  </xs:complexType>

  <xs:complexType name="timeType">
    <xs:sequence>
      <xs:element name="location" type="locationType" maxOccurs="unbounded" />
    </xs:sequence>
    <xs:attribute name="from" type="xs:dateTime" use="required" />
    <xs:attribute name="to" type="xs:dateTime" use="required" />
  </xs:complexType>

  <xs:complexType name="locationType">
    <xs:sequence maxOccurs="unbounded">
      <xs:element name="temperature" minOccurs="0">
        <xs:complexType>
          <xs:attribute name="unit" type="xs:string" use="required" />
          <xs:attribute name="value" type="xs:decimal" use="required" />
        </xs:complexType>
      </xs:element>
    </xs:sequence>
    <xs:attribute name="id" type="xs:string" use="optional" />
  </xs:complexType>
</xs:schema>`;

      // Generate TypeScript classes
      generateFromXsd(weatherSchema, tmpDir);

      // Read the generated weatherdata.ts file
      const weatherdataTsPath = join(tmpDir, "weatherdata.ts");
      const weatherdataTsContent = readFileSync(weatherdataTsPath, "utf-8");

      // Verify that the file was generated
      expect(weatherdataTsContent).toContain("@XmlRoot('weatherdata'");
      expect(weatherdataTsContent).toContain("@XmlElement('meta'");
      expect(weatherdataTsContent).toContain("@XmlElement('product'");

      // Verify that the locationType has temperature without a type specified
      const locationTypeTsContent = readFileSync(
        join(tmpDir, "locationType.ts"),
        "utf-8"
      );
      // temperature is defined inline so it should have no type: option or type: any
      expect(locationTypeTsContent).toContain("@XmlElement('temperature'");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("generates code from XMLSchema.xsd without errors", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "xmlschema-unmarshal-test-"));

    try {
      // Read the actual XMLSchema.xsd
      const xmlSchemaXsd = readFileSync(
        join(__dirname, "test-resources/XMLSchema.xsd"),
        "utf-8"
      );

      // Generate TypeScript classes - this should work without throwing
      expect(() => {
        generateFromXsd(xmlSchemaXsd, tmpDir);
      }).not.toThrow();

      // Verify key files were generated
      const schemaTs = readFileSync(join(tmpDir, "schema.ts"), "utf-8");

      // These elements should have undefined types (no type: option in decorator)
      expect(schemaTs).toContain("@XmlElement('include'");
      expect(schemaTs).toContain("@XmlElement('import'");
      expect(schemaTs).toContain("@XmlElement('annotation'");

      // These should have types specified
      expect(schemaTs).toContain("type: topLevelSimpleType");
      expect(schemaTs).toContain("type: topLevelComplexType");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
