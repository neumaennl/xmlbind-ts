import { readFileSync } from "fs";
import { join } from "path";
import { generateFromXsd } from "../src/xsd/TsGenerator";
import { withTmpDir } from "./test-utils/temp-dir";

describe("XSD Generator: Documentation", () => {
  test("generates TSDoc comments from xs:annotation/xs:documentation for complex types", () => {
    const xsd = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" 
           targetNamespace="http://example.com/test"
           elementFormDefault="qualified">
  
  <xs:complexType name="PersonType">
    <xs:annotation>
      <xs:documentation>Represents a person with basic information</xs:documentation>
    </xs:annotation>
    <xs:sequence>
      <xs:element name="name" type="xs:string"/>
    </xs:sequence>
  </xs:complexType>
  
</xs:schema>`;

    withTmpDir((tmpDir) => {
      generateFromXsd(xsd, tmpDir);
      const personTypeTs = readFileSync(join(tmpDir, "PersonType.ts"), "utf-8");

      // Should have TSDoc comment before the class
      expect(personTypeTs).toContain("/**");
      expect(personTypeTs).toContain(" * Represents a person with basic information");
      expect(personTypeTs).toContain(" */");
      expect(personTypeTs).toContain("@XmlRoot('PersonType'");
      expect(personTypeTs).toContain("export class PersonType {");
    });
  });

  test("generates TSDoc comments for element properties", () => {
    const xsd = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" 
           targetNamespace="http://example.com/test"
           elementFormDefault="qualified">
  
  <xs:complexType name="PersonType">
    <xs:sequence>
      <xs:element name="name" type="xs:string">
        <xs:annotation>
          <xs:documentation>The full name of the person</xs:documentation>
        </xs:annotation>
      </xs:element>
      <xs:element name="age" type="xs:int" minOccurs="0">
        <xs:annotation>
          <xs:documentation>The age of the person in years</xs:documentation>
        </xs:annotation>
      </xs:element>
    </xs:sequence>
  </xs:complexType>
  
</xs:schema>`;

    withTmpDir((tmpDir) => {
      generateFromXsd(xsd, tmpDir);
      const personTypeTs = readFileSync(join(tmpDir, "PersonType.ts"), "utf-8");

      // Should have TSDoc comments for both elements
      expect(personTypeTs).toContain("/**");
      expect(personTypeTs).toContain("   * The full name of the person");
      expect(personTypeTs).toContain("   */");
      expect(personTypeTs).toContain("@XmlElement('name'");
      
      expect(personTypeTs).toContain("   * The age of the person in years");
      expect(personTypeTs).toContain("@XmlElement('age'");
    });
  });

  test("generates TSDoc comments for attribute properties", () => {
    const xsd = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" 
           targetNamespace="http://example.com/test"
           elementFormDefault="qualified">
  
  <xs:complexType name="PersonType">
    <xs:sequence>
      <xs:element name="name" type="xs:string"/>
    </xs:sequence>
    <xs:attribute name="id" type="xs:string" use="required">
      <xs:annotation>
        <xs:documentation>Unique identifier for the person</xs:documentation>
      </xs:annotation>
    </xs:attribute>
    <xs:attribute name="status" type="xs:string">
      <xs:annotation>
        <xs:documentation>Current status of the person</xs:documentation>
      </xs:annotation>
    </xs:attribute>
  </xs:complexType>
  
</xs:schema>`;

    withTmpDir((tmpDir) => {
      generateFromXsd(xsd, tmpDir);
      const personTypeTs = readFileSync(join(tmpDir, "PersonType.ts"), "utf-8");

      // Should have TSDoc comments for both attributes
      expect(personTypeTs).toContain("  /**");
      expect(personTypeTs).toContain("   * Unique identifier for the person");
      expect(personTypeTs).toContain("   */");
      expect(personTypeTs).toContain("@XmlAttribute('id')");
      
      expect(personTypeTs).toContain("   * Current status of the person");
      expect(personTypeTs).toContain("@XmlAttribute('status')");
    });
  });

  test("generates TSDoc comments for top-level elements", () => {
    const xsd = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" 
           targetNamespace="http://example.com/test"
           elementFormDefault="qualified">
  
  <xs:complexType name="PersonType">
    <xs:sequence>
      <xs:element name="name" type="xs:string"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:element name="person" type="PersonType">
    <xs:annotation>
      <xs:documentation>Root element representing a person</xs:documentation>
    </xs:annotation>
  </xs:element>
  
</xs:schema>`;

    withTmpDir((tmpDir) => {
      generateFromXsd(xsd, tmpDir);
      const personTs = readFileSync(join(tmpDir, "person.ts"), "utf-8");

      // Should have TSDoc comment before the class
      expect(personTs).toContain("/**");
      expect(personTs).toContain(" * Root element representing a person");
      expect(personTs).toContain(" */");
      expect(personTs).toContain("@XmlRoot('person'");
      expect(personTs).toContain("export class person extends PersonType");
    });
  });

  test("handles multi-line documentation", () => {
    const xsd = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" 
           targetNamespace="http://example.com/test"
           elementFormDefault="qualified">
  
  <xs:complexType name="PersonType">
    <xs:annotation>
      <xs:documentation>
        Represents a person with basic information.
        This type includes essential fields like name and age.
        Use this type for all person-related data structures.
      </xs:documentation>
    </xs:annotation>
    <xs:sequence>
      <xs:element name="name" type="xs:string"/>
    </xs:sequence>
  </xs:complexType>
  
</xs:schema>`;

    withTmpDir((tmpDir) => {
      generateFromXsd(xsd, tmpDir);
      const personTypeTs = readFileSync(join(tmpDir, "PersonType.ts"), "utf-8");

      // Should have multi-line TSDoc comment
      expect(personTypeTs).toContain("/**");
      expect(personTypeTs).toContain(" * Represents a person with basic information.");
      expect(personTypeTs).toContain(" * This type includes essential fields like name and age.");
      expect(personTypeTs).toContain(" * Use this type for all person-related data structures.");
      expect(personTypeTs).toContain(" */");
    });
  });

  test("omits TSDoc when no documentation is present", () => {
    const xsd = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" 
           targetNamespace="http://example.com/test"
           elementFormDefault="qualified">
  
  <xs:complexType name="PersonType">
    <xs:sequence>
      <xs:element name="name" type="xs:string"/>
      <xs:element name="age" type="xs:int" minOccurs="0"/>
    </xs:sequence>
    <xs:attribute name="id" type="xs:string" use="required"/>
  </xs:complexType>
  
</xs:schema>`;

    withTmpDir((tmpDir) => {
      generateFromXsd(xsd, tmpDir);
      const personTypeTs = readFileSync(join(tmpDir, "PersonType.ts"), "utf-8");

      // Count /** occurrences (should be 0 since no documentation is provided)
      const docCommentCount = (personTypeTs.match(/\/\*\*/g) || []).length;
      expect(docCommentCount).toBe(0);
    });
  });

  test("generates documentation for referenced elements", () => {
    const xsd = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" 
           targetNamespace="http://example.com/test"
           elementFormDefault="qualified">
  
  <xs:element name="title" type="xs:string">
    <xs:annotation>
      <xs:documentation>The title of the document</xs:documentation>
    </xs:annotation>
  </xs:element>
  
  <xs:complexType name="DocumentType">
    <xs:sequence>
      <xs:element ref="title"/>
    </xs:sequence>
  </xs:complexType>
  
</xs:schema>`;

    withTmpDir((tmpDir) => {
      generateFromXsd(xsd, tmpDir);
      const documentTs = readFileSync(join(tmpDir, "DocumentType.ts"), "utf-8");

      // Should have documentation from the referenced element
      expect(documentTs).toContain("/**");
      expect(documentTs).toContain("   * The title of the document");
      expect(documentTs).toContain("   */");
      expect(documentTs).toContain("@XmlElement('title'");
    });
  });

  test("comprehensive test with all documentation types", () => {
    const xsd = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" 
           targetNamespace="http://example.com/test"
           elementFormDefault="qualified">
  
  <xs:complexType name="PersonType">
    <xs:annotation>
      <xs:documentation>Represents a person with detailed information</xs:documentation>
    </xs:annotation>
    <xs:sequence>
      <xs:element name="name" type="xs:string">
        <xs:annotation>
          <xs:documentation>Full name of the person</xs:documentation>
        </xs:annotation>
      </xs:element>
      <xs:element name="age" type="xs:int" minOccurs="0">
        <xs:annotation>
          <xs:documentation>Age in years</xs:documentation>
        </xs:annotation>
      </xs:element>
    </xs:sequence>
    <xs:attribute name="id" type="xs:string" use="required">
      <xs:annotation>
        <xs:documentation>Unique person identifier</xs:documentation>
      </xs:annotation>
    </xs:attribute>
  </xs:complexType>
  
  <xs:element name="person" type="PersonType">
    <xs:annotation>
      <xs:documentation>Person root element</xs:documentation>
    </xs:annotation>
  </xs:element>
  
</xs:schema>`;

    withTmpDir((tmpDir) => {
      generateFromXsd(xsd, tmpDir);
      
      // Check PersonType.ts
      const personTypeTs = readFileSync(join(tmpDir, "PersonType.ts"), "utf-8");
      expect(personTypeTs).toContain(" * Represents a person with detailed information");
      expect(personTypeTs).toContain("   * Unique person identifier");
      expect(personTypeTs).toContain("   * Full name of the person");
      expect(personTypeTs).toContain("   * Age in years");
      
      // Check person.ts
      const personTs = readFileSync(join(tmpDir, "person.ts"), "utf-8");
      expect(personTs).toContain(" * Person root element");
    });
  });
});
