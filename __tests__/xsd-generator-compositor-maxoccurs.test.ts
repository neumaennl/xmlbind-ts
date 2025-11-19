import { readFileSync } from "fs";
import path from "path";
import { withTmpDir } from "./test-utils/temp-dir";
import { setupGeneratedRuntime } from "./test-utils/generated-runtime";

describe("XSD Generator - Compositor maxOccurs", () => {
  test("generates arrays for elements in sequence/choice with maxOccurs > 1", () => {
    withTmpDir((tmpDir) => {
      // XSD with sequence having maxOccurs="unbounded" containing element references via group
      const xsd = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" 
           xmlns:tns="http://test.com"
           targetNamespace="http://test.com" 
           elementFormDefault="qualified">
  
  <xs:group name="itemGroup">
    <xs:choice>
      <xs:element ref="tns:item"/>
      <xs:element ref="tns:note"/>
    </xs:choice>
  </xs:group>
  
  <xs:element name="item" type="xs:string"/>
  <xs:element name="note" type="xs:string"/>
  
  <xs:element name="container">
    <xs:complexType>
      <xs:sequence>
        <xs:sequence minOccurs="0" maxOccurs="unbounded">
          <xs:group ref="tns:itemGroup"/>
        </xs:sequence>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

      setupGeneratedRuntime(tmpDir, [xsd]);

      const containerContent = readFileSync(path.join(tmpDir, "container.ts"), "utf8");
      
      // Verify that elements from the group inside the unbounded sequence are arrays
      expect(containerContent).toContain("array: true");
      expect(containerContent).toMatch(/item\?:\s*String\[\]/);
      expect(containerContent).toMatch(/note\?:\s*String\[\]/);
    });
  });

  test("generates arrays for elements in XMLSchema.xsd schema element", () => {
    withTmpDir((tmpDir) => {
      // Load the actual XMLSchema.xsd
      const xsdPath = path.join(__dirname, "test-resources", "XMLSchema.xsd");
      const xmlSchemaXsd = readFileSync(xsdPath, "utf-8");

      setupGeneratedRuntime(tmpDir, [xmlSchemaXsd]);

      const schemaContent = readFileSync(path.join(tmpDir, "schema.ts"), "utf8");
      
      // Verify that the 'element' property is an array (from schemaTop group inside unbounded sequence)
      expect(schemaContent).toContain("@XmlElement('element'");
      expect(schemaContent).toMatch(/@XmlElement\('element',\s*\{[^}]*array:\s*true[^}]*\}/);
      expect(schemaContent).toMatch(/element\?:\s*topLevelElement\[\]/);
      
      // Also verify other elements from schemaTop group are arrays
      expect(schemaContent).toMatch(/simpleType\?:\s*topLevelSimpleType\[\]/);
      expect(schemaContent).toMatch(/complexType\?:\s*topLevelComplexType\[\]/);
      expect(schemaContent).toMatch(/group\?:\s*namedGroup\[\]/);
      expect(schemaContent).toMatch(/attributeGroup\?:\s*namedAttributeGroup\[\]/);
    });
  });

  test("handles nested compositors with maxOccurs correctly", () => {
    withTmpDir((tmpDir) => {
      const xsd = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" targetNamespace="http://test.com" elementFormDefault="qualified">
  <xs:element name="root">
    <xs:complexType>
      <xs:sequence>
        <xs:choice minOccurs="0" maxOccurs="unbounded">
          <xs:element name="option1" type="xs:string"/>
          <xs:element name="option2" type="xs:int"/>
        </xs:choice>
        <xs:sequence minOccurs="0" maxOccurs="5">
          <xs:element name="repeated" type="xs:string"/>
        </xs:sequence>
        <xs:element name="single" type="xs:string"/>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

      setupGeneratedRuntime(tmpDir, [xsd]);

      const rootContent = readFileSync(path.join(tmpDir, "root.ts"), "utf8");
      
      // Elements in unbounded choice should be arrays (and optional because inside choice)
      expect(rootContent).toMatch(/option1\?:\s*String\[\]/);
      expect(rootContent).toMatch(/option2\?:\s*Number\[\]/);
      
      // Element in sequence with maxOccurs="5" should be array
      // Note: it's required (!:) because the element itself has default minOccurs="1"
      expect(rootContent).toMatch(/repeated!:\s*String\[\]/);
      
      // Single element with default maxOccurs="1" should not be array
      expect(rootContent).toMatch(/single!:\s*String;/);
      expect(rootContent).not.toMatch(/single.*:\s*String\[\]/);
    });
  });

  test("combines element maxOccurs with compositor maxOccurs", () => {
    withTmpDir((tmpDir) => {
      const xsd = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" targetNamespace="http://test.com" elementFormDefault="qualified">
  <xs:element name="container">
    <xs:complexType>
      <xs:sequence minOccurs="0" maxOccurs="unbounded">
        <xs:element name="item" type="xs:string" maxOccurs="3"/>
        <xs:element name="single" type="xs:string"/>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

      setupGeneratedRuntime(tmpDir, [xsd]);

      const containerContent = readFileSync(path.join(tmpDir, "container.ts"), "utf8");
      
      // Both elements should be arrays because sequence has maxOccurs="unbounded"
      // Note: they're required (!:) because elements have default minOccurs="1"
      expect(containerContent).toMatch(/item!:\s*String\[\]/);
      expect(containerContent).toMatch(/single!:\s*String\[\]/);
    });
  });
});
