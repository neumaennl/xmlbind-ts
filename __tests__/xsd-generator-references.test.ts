import { generateFromXsd } from "../src/xsd/TsGenerator";
import * as fs from "fs";
import * as path from "path";
import { withTmpDir } from "./test-utils/temp-dir";



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
      expect(content).toMatch(/\bTitle!?:\s*String/);

      // And the direct element
      expect(content).toContain("@XmlElement('content'");
      expect(content).toMatch(/\bcontent!?:\s*String/);
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
      expect(content).toMatch(/\bItem!?:\s*String\[\]/);
      expect(content).toContain("array: true");
    });
  });

  describe("Element reference edge cases", () => {
    test("handles element ref with nillable", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:element name="NullableField" type="xsd:int"/>
  
  <xsd:complexType name="NullableContainer">
    <xsd:sequence>
      <xsd:element ref="NullableField" nillable="true"/>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="NullableContainer" type="NullableContainer"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = fs.readFileSync(
          path.join(tmp, "NullableContainer.ts"),
          "utf8"
        );

        expect(content).toContain("nillable: true");
      });
    });

    test("handles element ref with minOccurs in choice", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:element name="OptionA" type="xsd:string"/>
  <xsd:element name="OptionB" type="xsd:int"/>
  
  <xsd:complexType name="Choice">
    <xsd:choice>
      <xsd:element ref="OptionA"/>
      <xsd:element ref="OptionB"/>
    </xsd:choice>
  </xsd:complexType>
  
  <xsd:element name="Choice" type="Choice"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = fs.readFileSync(path.join(tmp, "Choice.ts"), "utf8");

        expect(content).toContain("OptionA?: String");
        expect(content).toContain("OptionB?: Number");
      });
    });

    test("skips element without name attribute", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="MalformedElement">
    <xsd:sequence>
      <xsd:element type="xsd:string"/>
      <xsd:element name="valid" type="xsd:string"/>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="MalformedElement" type="MalformedElement"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = fs.readFileSync(
          path.join(tmp, "MalformedElement.ts"),
          "utf8"
        );

        expect(content).toContain("@XmlElement('valid'");
        const matches = content.match(/@XmlElement\(/g);
        expect(matches).toHaveLength(1);
      });
    });

    test("includes namespace in element decorator when qualified", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
            targetNamespace="http://example.com/ns"
            elementFormDefault="qualified">
  <xsd:complexType name="Namespaced">
    <xsd:sequence>
      <xsd:element name="field" type="xsd:string"/>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="Namespaced" type="Namespaced"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = fs.readFileSync(
          path.join(tmp, "Namespaced.ts"),
          "utf8"
        );

        expect(content).toContain("namespace: 'http://example.com/ns'");
      });
    });
  });
});
