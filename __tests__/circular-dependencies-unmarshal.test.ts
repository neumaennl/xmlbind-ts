/**
 * Tests for fixing unmarshalling problems with circular dependencies.
 *
 * This test file verifies that elements inside sequences of anonymous complex types
 * with namespace prefixes are properly unmarshalled into typed class instances
 * rather than raw JSON objects.
 *
 * Related issue: Circular dependencies between classes caused type references to be
 * undefined at decorator evaluation time, leading to improper unmarshalling.
 */

import { mkdtempSync, rmSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { generateFromXsd } from "../src/xsd/TsGenerator";
import { unmarshal } from "../src";

describe("Circular Dependencies Unmarshalling Fix", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "circular-deps-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  /**
   * Helper function to generate TypeScript classes from XSD and fix imports
   * to use the local source directory for testing.
   */
  function generateAndFixImports(xsdContent: string): void {
    generateFromXsd(xsdContent, tmpDir);

    const files = readdirSync(tmpDir);
    for (const file of files) {
      if (file.endsWith(".ts")) {
        const filePath = join(tmpDir, file);
        let content = readFileSync(filePath, "utf-8");
        content = content.replace(
          "from '@neumaennl/xmlbind-ts'",
          `from '${join(__dirname, "..", "src")}'`
        );
        writeFileSync(filePath, content);
      }
    }
  }

  test("unmarshals nested elements with circular dependencies correctly", async () => {
    // Create a schema with circular dependencies similar to XMLSchema.xsd
    // where localSimpleType contains restriction which can contain localSimpleType
    const XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
           targetNamespace="http://example.com/circular"
           xmlns:tns="http://example.com/circular"
           elementFormDefault="qualified">

  <!-- Forward reference creates circular dependency -->
  <xs:complexType name="SimpleType">
    <xs:sequence>
      <xs:element name="restriction" type="tns:RestrictionType" minOccurs="0"/>
    </xs:sequence>
    <xs:attribute name="name" type="xs:string"/>
  </xs:complexType>

  <xs:complexType name="RestrictionType">
    <xs:sequence>
      <!-- This creates a circular dependency: RestrictionType -> SimpleType -> RestrictionType -->
      <xs:element name="simpleType" type="tns:SimpleType" minOccurs="0"/>
      <xs:element name="enumeration" type="tns:Facet" minOccurs="0" maxOccurs="unbounded"/>
    </xs:sequence>
    <xs:attribute name="base" type="xs:string"/>
  </xs:complexType>

  <xs:complexType name="Facet">
    <xs:attribute name="value" type="xs:string"/>
  </xs:complexType>

  <xs:element name="schema">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="simpleType" type="tns:SimpleType" minOccurs="0" maxOccurs="unbounded"/>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

    generateAndFixImports(XSD);

    // Dynamically import the generated schema class
    const { schema } = await import(join(tmpDir, "schema"));

    // Test XML with nested structures
    const testXml = `<?xml version="1.0" encoding="UTF-8"?>
<tns:schema xmlns:tns="http://example.com/circular">
  <tns:simpleType name="myType">
    <tns:restriction base="xs:string">
      <tns:enumeration value="value1"/>
      <tns:enumeration value="value2"/>
    </tns:restriction>
  </tns:simpleType>
</tns:schema>`;

    const result = unmarshal(schema, testXml) as any;

    // Verify the structure is properly typed
    expect(result).toBeDefined();
    expect(result.simpleType).toBeDefined();
    // Note: With a single element, fast-xml-parser returns the value directly,
    // not as an array. When the isArray option is set on the field metadata,
    // the unmarshaller should handle this gracefully.

    // Get simpleType - it may be a single value or an array depending on how many exist
    const simpleType = Array.isArray(result.simpleType)
      ? result.simpleType[0]
      : result.simpleType;
    expect(simpleType.constructor.name).toBe("SimpleType");
    expect(simpleType.name).toBe("myType");

    // Verify the restriction is a typed class, not a raw object
    const restriction = simpleType.restriction;
    expect(restriction).toBeDefined();
    expect(restriction.constructor.name).toBe("RestrictionType");
    expect(restriction.base).toBe("xs:string");

    // Verify enumeration values are typed
    expect(restriction.enumeration).toBeDefined();
    expect(Array.isArray(restriction.enumeration)).toBe(true);
    expect(restriction.enumeration.length).toBe(2);
    expect(restriction.enumeration[0].constructor.name).toBe("Facet");
    expect(restriction.enumeration[0].value).toBe("value1");
    expect(restriction.enumeration[1].value).toBe("value2");
  });

  test("uses lazy type references in generated code", () => {
    const XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
           targetNamespace="http://example.com/test"
           elementFormDefault="qualified">
  <xs:complexType name="Parent">
    <xs:sequence>
      <xs:element name="child" type="xs:string"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="Container">
    <xs:sequence>
      <xs:element name="parent" type="Parent"/>
    </xs:sequence>
  </xs:complexType>
</xs:schema>`;

    generateAndFixImports(XSD);

    // Read the generated Container.ts file
    const containerFile = readFileSync(join(tmpDir, "Container.ts"), "utf-8");

    // Verify that lazy type reference is used
    expect(containerFile).toMatch(/type:\s*\(\)\s*=>\s*Parent/);

    // Verify the property type is still typed correctly
    expect(containerFile).toMatch(/parent[!?]?:\s*Parent;/);
  });

  test("unmarshals XMLSchema.xsd with example.xsd correctly", async () => {
    // Generate classes from XMLSchema.xsd
    const xmlSchemaXsd = readFileSync(
      join(__dirname, "test-resources/XMLSchema.xsd"),
      "utf-8"
    );
    generateAndFixImports(xmlSchemaXsd);

    // Import the generated schema class
    const { schema } = await import(join(tmpDir, "schema"));

    // Read and unmarshal example.xsd
    const exampleXsd = readFileSync(
      join(__dirname, "test-resources/example.xsd"),
      "utf-8"
    );
    const result = unmarshal(schema, exampleXsd) as any;

    // Verify the result is properly typed
    expect(result).toBeDefined();

    // Verify complexType array is properly typed
    expect(result.complexType).toBeDefined();
    expect(Array.isArray(result.complexType)).toBe(true);
    expect(result.complexType.length).toBe(2);

    // Check the loggingType complexType
    const loggingType = result.complexType[1];
    expect(loggingType.name).toBe("loggingType");

    // Verify nested structures are typed correctly
    const attr = loggingType.attribute as any;
    expect(attr).toBeDefined();
    expect(attr.name).toBe("logLevel");

    // The simpleType inside attribute should be typed
    expect(attr.simpleType).toBeDefined();
    expect(attr.simpleType.constructor.name).toBe("localSimpleType");

    // The restriction inside simpleType should be typed (not raw JSON)
    const restriction = attr.simpleType.restriction;
    expect(restriction).toBeDefined();
    expect(restriction.constructor.name).toBe("restrictionType");

    // The enumeration values should be typed
    expect(restriction.enumeration).toBeDefined();
    expect(Array.isArray(restriction.enumeration)).toBe(true);
    expect(restriction.enumeration.length).toBe(5);
    expect(restriction.enumeration[0].constructor.name).toBe("noFixedFacet");
    expect(restriction.enumeration[0].value).toBe("error");
  });
});
