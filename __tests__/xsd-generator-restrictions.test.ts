import { generateFromXsd } from "../src/xsd/TsGenerator";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { withTmpDir } from "./test-utils/temp-dir";

describe("XSD Generator - Restrictions", () => {
  test("handles attributeGroup refs in base type when using restriction", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:attributeGroup name="defRef">
    <xs:attribute name="name" type="xs:NCName"/>
    <xs:attribute name="ref" type="xs:QName"/>
  </xs:attributeGroup>
  
  <xs:complexType name="element" abstract="true">
    <xs:sequence>
      <xs:element name="annotation" type="xs:string" minOccurs="0"/>
    </xs:sequence>
    <xs:attributeGroup ref="xs:defRef"/>
    <xs:attribute name="type" type="xs:QName"/>
  </xs:complexType>
  
  <xs:complexType name="localElement">
    <xs:complexContent>
      <xs:restriction base="xs:element">
        <xs:sequence>
          <xs:element name="annotation" type="xs:string" minOccurs="0"/>
        </xs:sequence>
        <xs:attribute name="type" type="xs:QName"/>
      </xs:restriction>
    </xs:complexContent>
  </xs:complexType>
  
  <xs:element name="LocalElement" type="localElement"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      const localElementFile = path.join(dir, "localElement.ts");
      expect(existsSync(localElementFile)).toBe(true);

      const content = readFileSync(localElementFile, "utf-8");

      // Should have attributes from the attributeGroup referenced in base type
      // Even though the restriction doesn't explicitly include the attributeGroup ref,
      // it should inherit the attributes from the base type's attributeGroup
      expect(content).toContain("@XmlAttribute('name')");
      expect(content).toContain("name?:");
      expect(content).toContain("@XmlAttribute('ref')");
      expect(content).toContain("ref?:");

      // Should also have the attribute explicitly in the restriction
      // Note: 'type' is a reserved word so it becomes 'type_'
      expect(content).toContain("@XmlAttribute('type')");
      expect(content).toContain("type_?:");
    });
  });

  test("handles nested attributeGroups in base type restriction", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:attributeGroup name="identityAttrs">
    <xs:attribute name="id" type="xs:ID"/>
    <xs:attribute name="version" type="xs:string"/>
  </xs:attributeGroup>
  
  <xs:attributeGroup name="metadataAttrs">
    <xs:attribute name="created" type="xs:dateTime"/>
    <xs:attribute name="modified" type="xs:dateTime"/>
  </xs:attributeGroup>
  
  <xs:complexType name="baseDocument">
    <xs:sequence>
      <xs:element name="title" type="xs:string"/>
      <xs:element name="content" type="xs:string"/>
    </xs:sequence>
    <xs:attributeGroup ref="xs:identityAttrs"/>
    <xs:attributeGroup ref="xs:metadataAttrs"/>
    <xs:attribute name="status" type="xs:string"/>
  </xs:complexType>
  
  <xs:complexType name="restrictedDocument">
    <xs:complexContent>
      <xs:restriction base="xs:baseDocument">
        <xs:sequence>
          <xs:element name="title" type="xs:string"/>
        </xs:sequence>
        <xs:attribute name="status" type="xs:string" fixed="draft"/>
      </xs:restriction>
    </xs:complexContent>
  </xs:complexType>
  
  <xs:element name="RestrictedDoc" type="restrictedDocument"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      const docFile = path.join(dir, "restrictedDocument.ts");
      expect(existsSync(docFile)).toBe(true);

      const content = readFileSync(docFile, "utf-8");

      // Should have attributes from both attributeGroups in base type
      expect(content).toContain("@XmlAttribute('id')");
      expect(content).toContain("@XmlAttribute('version')");
      expect(content).toContain("@XmlAttribute('created')");
      expect(content).toContain("@XmlAttribute('modified')");
      expect(content).toContain("@XmlAttribute('status')");
    });
  });

  test("handles direct attributes (not in attributeGroups) from base type", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:complexType name="baseType">
    <xs:sequence>
      <xs:element name="data" type="xs:string"/>
    </xs:sequence>
    <xs:attribute name="id" type="xs:ID"/>
    <xs:attribute name="version" type="xs:string"/>
    <xs:attribute name="status" type="xs:string" default="active"/>
  </xs:complexType>
  
  <xs:complexType name="restrictedType">
    <xs:complexContent>
      <xs:restriction base="xs:baseType">
        <xs:sequence>
          <xs:element name="data" type="xs:string"/>
        </xs:sequence>
        <xs:attribute name="status" type="xs:string" fixed="draft"/>
      </xs:restriction>
    </xs:complexContent>
  </xs:complexType>
  
  <xs:element name="RestrictedItem" type="restrictedType"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      const restrictedFile = path.join(dir, "restrictedType.ts");
      expect(existsSync(restrictedFile)).toBe(true);

      const content = readFileSync(restrictedFile, "utf-8");

      // Should have all direct attributes from base type
      expect(content).toContain("@XmlAttribute('id')");
      expect(content).toContain("id?:");
      expect(content).toContain("@XmlAttribute('version')");
      expect(content).toContain("version?:");

      // Should have the restricted attribute (only once, not duplicated)
      expect(content).toContain("@XmlAttribute('status')");
      const statusMatches = content.match(/@XmlAttribute\('status'\)/g);
      expect(statusMatches).toHaveLength(1);
    });
  });

  test("handles anyAttribute from base type in restriction", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:complexType name="extensibleBase">
    <xs:sequence>
      <xs:element name="name" type="xs:string"/>
    </xs:sequence>
    <xs:attribute name="id" type="xs:ID"/>
    <xs:anyAttribute namespace="##other" processContents="lax"/>
  </xs:complexType>
  
  <xs:complexType name="restrictedExtensible">
    <xs:complexContent>
      <xs:restriction base="xs:extensibleBase">
        <xs:sequence>
          <xs:element name="name" type="xs:string"/>
        </xs:sequence>
        <xs:attribute name="id" type="xs:ID" use="required"/>
        <xs:anyAttribute namespace="##other" processContents="lax"/>
      </xs:restriction>
    </xs:complexContent>
  </xs:complexType>
  
  <xs:element name="RestrictedExt" type="restrictedExtensible"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      const restrictedFile = path.join(dir, "restrictedExtensible.ts");
      expect(existsSync(restrictedFile)).toBe(true);

      const content = readFileSync(restrictedFile, "utf-8");

      // Should have the attribute
      expect(content).toContain("@XmlAttribute('id')");
      expect(content).toContain("id!:"); // required in restriction

      // Should have anyAttribute (only once)
      expect(content).toContain("@XmlAnyAttribute(");
      const anyAttrMatches = content.match(/@XmlAnyAttribute\(/g);
      expect(anyAttrMatches).toHaveLength(1);
    });
  });
});
