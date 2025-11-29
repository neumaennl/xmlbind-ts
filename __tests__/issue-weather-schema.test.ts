import { mkdtempSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { generateFromXsd } from "../src/xsd/TsGenerator";
import { unmarshal, XmlRoot, XmlElement, XmlAttribute } from "../src/index";

describe("Issue: Weather Schema Unmarshalling", () => {
  test("unmarshals weather schema XML using classes that mimic XMLSchema.xsd structure", () => {
    // This test simulates the original issue:
    // 1. User generates classes from XMLSchema.xsd
    // 2. Some elements in the generated schema class have no type specified (like include, import, annotation)
    // 3. User tries to unmarshal a weather schema XML document
    // 4. Before the fix, this threw "TypeError: cls is not a constructor"

    // Define a minimal schema class that mimics the structure generated from XMLSchema.xsd
    // The key is that some elements have no type specified
    @XmlRoot("schema", {
      namespace: "http://www.w3.org/2001/XMLSchema",
    })
    class SchemaClass {
      @XmlAttribute("elementFormDefault")
      elementFormDefault?: string;

      @XmlAttribute("attributeFormDefault")
      attributeFormDefault?: string;

      // These elements have no type specified - mimicking generated code from XMLSchema.xsd
      // This is what was causing the "cls is not a constructor" error
      @XmlElement("include", {
        namespace: "http://www.w3.org/2001/XMLSchema",
      })
      include?: any;

      @XmlElement("import", {
        namespace: "http://www.w3.org/2001/XMLSchema",
      })
      import_?: any;

      @XmlElement("annotation", {
        namespace: "http://www.w3.org/2001/XMLSchema",
      })
      annotation?: any;

      @XmlElement("element", {
        namespace: "http://www.w3.org/2001/XMLSchema",
        array: true,
      })
      elements?: any[];

      @XmlElement("complexType", {
        namespace: "http://www.w3.org/2001/XMLSchema",
        array: true,
      })
      complexTypes?: any[];
    }

    // Weather schema XML document to unmarshal
    const weatherSchemaXml = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" 
           elementFormDefault="qualified"
           attributeFormDefault="unqualified">
  <xs:annotation>
    <xs:documentation>Weather data schema</xs:documentation>
  </xs:annotation>
  
  <xs:element name="weatherdata">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="meta" type="metaType" minOccurs="0" />
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
</xs:schema>`;

    // Before the fix, this would throw: "TypeError: cls is not a constructor"
    // because annotation, elements, and complexTypes have no type specified
    const result = unmarshal(SchemaClass, weatherSchemaXml) as any;

    // Verify the unmarshalling succeeded
    expect(result).toBeDefined();
    expect(result.elementFormDefault).toBe("qualified");
    expect(result.attributeFormDefault).toBe("unqualified");

    // Verify elements with no type were successfully unmarshalled as raw values
    expect(result.annotation).toBeDefined();
    expect(result.elements).toBeDefined();
    // elements and complexTypes might be single objects or arrays depending on count
    // Just verify they're defined and are objects (not undefined/null)
    expect(
      result.elements &&
        (typeof result.elements === "object" || Array.isArray(result.elements))
    ).toBe(true);
    expect(result.complexTypes).toBeDefined();
    expect(
      result.complexTypes &&
        (typeof result.complexTypes === "object" ||
          Array.isArray(result.complexTypes))
    ).toBe(true);
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

      // These should have types specified (lazy type references to avoid circular dependency issues)
      expect(schemaTs).toContain("type: () => topLevelSimpleType");
      expect(schemaTs).toContain("type: () => topLevelComplexType");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
