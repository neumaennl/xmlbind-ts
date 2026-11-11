import { generateFromXsd } from "../src/xsd/TsGenerator.js";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { withTmpDir } from "./test-utils/temp-dir.js";

describe("XSD Generator - Element and Attribute References", () => {
  test("handles element references", async () => {
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

    await withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      const docFile = path.join(dir, "Document.ts");
      expect(existsSync(docFile)).toBe(true);

      const content = readFileSync(docFile, "utf-8");

      // Should have the referenced element
      expect(content).toContain("@XmlElement('Title'");
      expect(content).toMatch(/\bTitle!?:\s*string/);

      // And the direct element
      expect(content).toContain("@XmlElement('content'");
      expect(content).toMatch(/\bcontent!?:\s*string/);
    });
  });

  test("handles attribute references", async () => {
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

    await withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      const docFile = path.join(dir, "Document.ts");
      expect(existsSync(docFile)).toBe(true);

      const content = readFileSync(docFile, "utf-8");

      // Should have the referenced attribute
      expect(content).toContain("@XmlAttribute('version'");
      expect(content).toContain("version?: string");

      // And the direct attribute
      expect(content).toContain("@XmlAttribute('status'");
      expect(content).toContain("status?: string");
    });
  });

  test("handles element reference with maxOccurs", async () => {
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

    await withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      const listFile = path.join(dir, "List.ts");
      const content = readFileSync(listFile, "utf-8");

      // Should generate an array
      expect(content).toMatch(/\bItem!?:\s*string\[\]/);
      expect(content).toContain("array: true");
    });
  });

  describe("Element reference edge cases", () => {
    test("handles element ref with nillable", async () => {
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

      await withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(
          path.join(tmp, "NullableContainer.ts"),
          "utf8"
        );

        expect(content).toContain("nillable: true");
        expect(content).toMatch(/NullableField[!?]?:\s*number \| null/);
      });
    });

    test("includes null in the item type of nillable array references", async () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:element name="NullableField" type="xsd:int"/>

  <xsd:complexType name="NullableContainer">
    <xsd:sequence>
      <xsd:element ref="NullableField" nillable="true" maxOccurs="unbounded"/>
      <xsd:element name="nullableDirect" type="xsd:int" nillable="true" maxOccurs="unbounded"/>
    </xsd:sequence>
  </xsd:complexType>

  <xsd:element name="NullableContainer" type="NullableContainer"/>
</xsd:schema>`;

      await withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(
          path.join(tmp, "NullableContainer.ts"),
          "utf8"
        );

        expect(content).toMatch(/NullableField[!?]?:\s*\(number \| null\)\[\]/);
        expect(content).toMatch(/nullableDirect[!?]?:\s*\(number \| null\)\[\]/);
      });
    });

    test("handles element ref with minOccurs in choice", async () => {
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

      await withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(path.join(tmp, "Choice.ts"), "utf8");

        expect(content).toContain("OptionA?: string");
        expect(content).toContain("OptionB?: number");
      });
    });

    test("skips element without name attribute", async () => {
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

      await withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(
          path.join(tmp, "MalformedElement.ts"),
          "utf8"
        );

        expect(content).toContain("@XmlElement('valid'");
        const matches = content.match(/@XmlElement\(/g);
        expect(matches).toHaveLength(1);
      });
    });

    test("includes namespace in element decorator when qualified", async () => {
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

      await withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(path.join(tmp, "Namespaced.ts"), "utf8");

        expect(content).toContain("namespace: 'http://example.com/ns'");
      });
    });
  });

  describe("Types of referenced elements and attributes", () => {
    const XSD = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:simpleType name="Color">
    <xs:restriction base="xs:string">
      <xs:enumeration value="red"/>
      <xs:enumeration value="blue"/>
    </xs:restriction>
  </xs:simpleType>
  <xs:element name="color" type="Color"/>
  <xs:element name="code">
    <xs:simpleType>
      <xs:restriction base="xs:string"><xs:maxLength value="3"/></xs:restriction>
    </xs:simpleType>
  </xs:element>
  <xs:simpleType name="size"><xs:restriction base="xs:int"/></xs:simpleType>
  <xs:element name="size">
    <xs:simpleType><xs:restriction base="xs:int"/></xs:simpleType>
  </xs:element>
  <xs:attribute name="shade" type="Color">
    <xs:annotation><xs:documentation>The shade.</xs:documentation></xs:annotation>
  </xs:attribute>
  <xs:complexType name="Paint">
    <xs:sequence>
      <xs:element ref="color"/>
      <xs:element ref="code"/>
      <xs:element ref="size"/>
    </xs:sequence>
    <xs:attribute ref="shade" use="required"/>
  </xs:complexType>
  <xs:element name="paint" type="Paint"/>
</xs:schema>`;

    test("uses the enum of a referenced element with an enum type", async () => {
      await withTmpDir((dir) => {
        generateFromXsd(XSD, dir);
        const content = readFileSync(path.join(dir, "Paint.ts"), "utf8");

        expect(content).toContain("import { Color } from './enums.js';");
        expect(content).toMatch(/\bcolor!:\s*Color;/);
      });
    });

    test("uses the wrapper class of a referenced element with an inline simple type", async () => {
      await withTmpDir((dir) => {
        generateFromXsd(XSD, dir);
        const content = readFileSync(path.join(dir, "Paint.ts"), "utf8");

        expect(content).toContain("import { code } from './code.js';");
        expect(content).toContain("@XmlElement('code', { type: () => code })");
        expect(content).toMatch(/\bcode!:\s*code;/);
      });
    });

    test("uses the suffixed wrapper class when the element name collides with a type", async () => {
      await withTmpDir((dir) => {
        generateFromXsd(XSD, dir);
        const content = readFileSync(path.join(dir, "Paint.ts"), "utf8");

        expect(existsSync(path.join(dir, "sizeElement.ts"))).toBe(true);
        expect(content).toContain("import { sizeElement } from './sizeElement.js';");
        expect(content).toMatch(/\bsize!:\s*sizeElement;/);
      });
    });

    test("uses the enum, documentation and use of a referenced attribute", async () => {
      await withTmpDir((dir) => {
        generateFromXsd(XSD, dir);
        const content = readFileSync(path.join(dir, "Paint.ts"), "utf8");

        expect(content).toContain("The shade.");
        expect(content).toContain("@XmlAttribute('shade')");
        expect(content).toMatch(/\bshade!:\s*Color;/);
      });
    });
  });
});
