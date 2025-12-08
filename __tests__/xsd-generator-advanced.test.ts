import { generateFromXsd } from "../src/xsd/TsGenerator";
import { readFileSync } from "fs";
import path from "path";
import { withTmpDir } from "./test-utils/temp-dir";

describe("XSD Generator advanced features", () => {
  test("adds imports for referenced complex types", () => {
    const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com/ns" elementFormDefault="qualified">
  <xsd:complexType name="Address">
    <xsd:sequence>
      <xsd:element name="street" type="xsd:string"/>
    </xsd:sequence>
  </xsd:complexType>
  <xsd:complexType name="Person">
    <xsd:sequence>
      <xsd:element name="name" type="xsd:string"/>
      <xsd:element name="address" type="Address"/>
    </xsd:sequence>
  </xsd:complexType>
</xsd:schema>`;

    withTmpDir((tmp) => {
      generateFromXsd(XSD, tmp);
      const person = readFileSync(path.join(tmp, "Person.ts"), "utf8");
      expect(person).toContain("import { Address } from './Address';");
      // Lazy type reference to avoid circular dependency issues
      expect(person).toMatch(
        /@XmlElement\('address',\s*\{\s*type:\s*\(\)\s*=>\s*Address,\s*namespace:\s*'http:\/\/example.com\/ns'\s*\}\)/
      );
      expect(person).toMatch(/address!?:\s*Address;/);
    });
  });

  test("generates class for top-level element with anonymous complexType", () => {
    const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com/ns" elementFormDefault="qualified">
  <xsd:element name="Book">
    <xsd:complexType>
      <xsd:sequence>
        <xsd:element name="title" type="xsd:string"/>
      </xsd:sequence>
      <xsd:attribute name="id" type="xsd:int"/>
    </xsd:complexType>
  </xsd:element>
</xsd:schema>`;

    withTmpDir((tmp) => {
      generateFromXsd(XSD, tmp);
      const book = readFileSync(path.join(tmp, "Book.ts"), "utf8");
      expect(book).toContain("export class Book");
      expect(book).toMatch(/@XmlAttribute\('id'\)/);
      expect(book).toMatch(
        /@XmlElement\('title',\s*\{\s*type:\s*String,\s*namespace:\s*'http:\/\/example.com\/ns'\s*\}\)/
      );
      expect(book).toMatch(/title!?: string/);
    });
  });

  test("emits extends for complexContent extension and wrapper for top-level element", () => {
    const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com/ns" elementFormDefault="qualified">
  <xsd:complexType name="BaseType">
    <xsd:sequence>
      <xsd:element name="name" type="xsd:string"/>
    </xsd:sequence>
    <xsd:attribute name="id" type="xsd:int"/>
  </xsd:complexType>
  <xsd:complexType name="EmployeeType">
    <xsd:complexContent>
      <xsd:extension base="BaseType">
        <xsd:sequence>
          <xsd:element name="role" type="xsd:string"/>
        </xsd:sequence>
      </xsd:extension>
    </xsd:complexContent>
  </xsd:complexType>
  <xsd:element name="Employee" type="EmployeeType"/>
</xsd:schema>`;

    withTmpDir((tmp) => {
      generateFromXsd(XSD, tmp);
      const empType = readFileSync(path.join(tmp, "EmployeeType.ts"), "utf8");
      expect(empType).toContain("import { BaseType } from './BaseType';");
      expect(empType).toMatch(/export class EmployeeType extends BaseType/);
      const emp = readFileSync(path.join(tmp, "Employee.ts"), "utf8");
      expect(emp).toMatch(/@XmlRoot\('Employee'/);
      expect(emp).toMatch(/export class Employee extends EmployeeType/);
    });
  });

  test("disambiguates when element and complexType have same name", () => {
    const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com/ns" elementFormDefault="qualified">
  <xsd:complexType name="Person">
    <xsd:sequence>
      <xsd:element name="name" type="xsd:string"/>
    </xsd:sequence>
  </xsd:complexType>
  <xsd:element name="Person">
    <xsd:complexType>
      <xsd:sequence>
        <xsd:element name="id" type="xsd:int"/>
      </xsd:sequence>
    </xsd:complexType>
  </xsd:element>
</xsd:schema>`;

    withTmpDir((tmp) => {
      generateFromXsd(XSD, tmp);

      // complexType should generate Person.ts
      const personType = readFileSync(path.join(tmp, "Person.ts"), "utf8");
      expect(personType).toContain("export class Person");
      expect(personType).toMatch(
        /@XmlElement\('name',\s*\{\s*type:\s*String,\s*namespace:\s*'http:\/\/example.com\/ns'\s*\}\)/
      );

      // element should generate PersonElement.ts with @XmlRoot('Person')
      const personElement = readFileSync(
        path.join(tmp, "PersonElement.ts"),
        "utf8"
      );
      expect(personElement).toContain("export class PersonElement");
      expect(personElement).toMatch(/@XmlRoot\('Person'/);
      expect(personElement).toMatch(
        /@XmlElement\('id',\s*\{\s*type:\s*Number,\s*namespace:\s*'http:\/\/example.com\/ns'\s*\}\)/
      );
    });
  });

  describe("simpleContent", () => {
    test("generates class with @XmlText for simpleContent with extension", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="ShoeSize">
    <xsd:simpleContent>
      <xsd:extension base="xsd:integer">
        <xsd:attribute name="country" type="xsd:string"/>
      </xsd:extension>
    </xsd:simpleContent>
  </xsd:complexType>
  <xsd:element name="ShoeSize" type="ShoeSize"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(path.join(tmp, "ShoeSize.ts"), "utf8");

        expect(content).toContain("@XmlText()");
        expect(content).toContain("value?: number;");

        expect(content).toContain("@XmlAttribute('country')");
        expect(content).toContain("country?: string;");
      });
    });

    test("generates class with @XmlText for simpleContent with restriction", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="PostalCode">
    <xsd:simpleContent>
      <xsd:restriction base="xsd:string">
        <xsd:attribute name="region" type="xsd:string"/>
      </xsd:restriction>
    </xsd:simpleContent>
  </xsd:complexType>
  <xsd:element name="PostalCode" type="PostalCode"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(path.join(tmp, "PostalCode.ts"), "utf8");

        expect(content).toContain("@XmlText()");
        expect(content).toContain("value?: string;");

        expect(content).toContain("@XmlAttribute('region')");
      });
    });

    test("generates class with @XmlText without base type", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="SimpleValue">
    <xsd:simpleContent>
      <xsd:extension>
        <xsd:attribute name="id" type="xsd:int"/>
      </xsd:extension>
    </xsd:simpleContent>
  </xsd:complexType>
  <xsd:element name="SimpleValue" type="SimpleValue"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(path.join(tmp, "SimpleValue.ts"), "utf8");

        expect(content).toContain("@XmlText()");
        expect(content).toContain("value?: string;");
      });
    });

    test("maps various base types correctly in simpleContent", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="BooleanValue">
    <xsd:simpleContent>
      <xsd:extension base="xsd:boolean">
        <xsd:attribute name="id" type="xsd:int"/>
      </xsd:extension>
    </xsd:simpleContent>
  </xsd:complexType>
  <xsd:complexType name="DateValue">
    <xsd:simpleContent>
      <xsd:extension base="xsd:date">
        <xsd:attribute name="id" type="xsd:int"/>
      </xsd:extension>
    </xsd:simpleContent>
  </xsd:complexType>
  <xsd:element name="BooleanValue" type="BooleanValue"/>
  <xsd:element name="DateValue" type="DateValue"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);

        const boolContent = readFileSync(
          path.join(tmp, "BooleanValue.ts"),
          "utf8"
        );
        expect(boolContent).toContain("value?: boolean;");

        const dateContent = readFileSync(
          path.join(tmp, "DateValue.ts"),
          "utf8"
        );
        expect(dateContent).toContain("value?: Date;");
      });
    });
  });

  describe("complexContent restriction", () => {
    test("generates class for complexContent with restriction", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="BaseType">
    <xsd:sequence>
      <xsd:element name="name" type="xsd:string"/>
      <xsd:element name="age" type="xsd:int"/>
    </xsd:sequence>
  </xsd:complexType>
  <xsd:complexType name="RestrictedType">
    <xsd:complexContent>
      <xsd:restriction base="BaseType">
        <xsd:sequence>
          <xsd:element name="name" type="xsd:string"/>
        </xsd:sequence>
        <xsd:attribute name="id" type="xsd:int"/>
      </xsd:restriction>
    </xsd:complexContent>
  </xsd:complexType>
  <xsd:element name="RestrictedType" type="RestrictedType"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(
          path.join(tmp, "RestrictedType.ts"),
          "utf8"
        );

        expect(content).not.toContain("extends BaseType");

        expect(content).toContain("@XmlElement('name'");
        expect(content).toContain("@XmlAttribute('id')");
      });
    });

    test("generates class for complexContent restriction without base type", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="EmptyRestriction">
    <xsd:complexContent>
      <xsd:restriction>
        <xsd:sequence>
          <xsd:element name="field" type="xsd:string"/>
        </xsd:sequence>
      </xsd:restriction>
    </xsd:complexContent>
  </xsd:complexType>
  <xsd:element name="EmptyRestriction" type="EmptyRestriction"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(
          path.join(tmp, "EmptyRestriction.ts"),
          "utf8"
        );

        expect(content).toContain("export class EmptyRestriction {");
        expect(content).toContain("@XmlElement('field'");
      });
    });
  });

  describe("mixed content", () => {
    test("generates @XmlText for mixed content in complexType", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="MixedContent" mixed="true">
    <xsd:sequence>
      <xsd:element name="bold" type="xsd:string" minOccurs="0" maxOccurs="unbounded"/>
      <xsd:element name="italic" type="xsd:string" minOccurs="0" maxOccurs="unbounded"/>
    </xsd:sequence>
  </xsd:complexType>
  <xsd:element name="MixedContent" type="MixedContent"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(path.join(tmp, "MixedContent.ts"), "utf8");

        expect(content).toContain("@XmlText()");
        expect(content).toContain("value?: string;");

        expect(content).toContain("@XmlElement('bold'");
        expect(content).toContain("@XmlElement('italic'");
      });
    });

    test("generates @XmlText for mixed content with extension", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="BaseType">
    <xsd:sequence>
      <xsd:element name="name" type="xsd:string"/>
    </xsd:sequence>
  </xsd:complexType>
  <xsd:complexType name="MixedExtension" mixed="true">
    <xsd:complexContent>
      <xsd:extension base="BaseType">
        <xsd:sequence>
          <xsd:element name="description" type="xsd:string"/>
        </xsd:sequence>
      </xsd:extension>
    </xsd:complexContent>
  </xsd:complexType>
  <xsd:element name="MixedExtension" type="MixedExtension"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(
          path.join(tmp, "MixedExtension.ts"),
          "utf8"
        );

        expect(content).toContain("extends BaseType");

        expect(content).toContain("@XmlText()");
        expect(content).toContain("value?: string;");

        expect(content).toContain("@XmlElement('description'");
      });
    });

    test("generates @XmlText for mixed content with restriction", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="BaseType">
    <xsd:sequence>
      <xsd:element name="name" type="xsd:string"/>
    </xsd:sequence>
  </xsd:complexType>
  <xsd:complexType name="MixedRestriction" mixed="true">
    <xsd:complexContent>
      <xsd:restriction base="BaseType">
        <xsd:sequence>
          <xsd:element name="name" type="xsd:string"/>
        </xsd:sequence>
      </xsd:restriction>
    </xsd:complexContent>
  </xsd:complexType>
  <xsd:element name="MixedRestriction" type="MixedRestriction"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(
          path.join(tmp, "MixedRestriction.ts"),
          "utf8"
        );

        expect(content).not.toContain("extends BaseType");

        expect(content).toContain("@XmlText()");
        expect(content).toContain("value?: string;");
      });
    });
  });

  describe("complexContent extension edge cases", () => {
    test("does not extend when base is builtin type", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="ExtendedString">
    <xsd:complexContent>
      <xsd:extension base="xsd:string">
        <xsd:sequence>
          <xsd:element name="metadata" type="xsd:string"/>
        </xsd:sequence>
      </xsd:extension>
    </xsd:complexContent>
  </xsd:complexType>
  <xsd:element name="ExtendedString" type="ExtendedString"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(
          path.join(tmp, "ExtendedString.ts"),
          "utf8"
        );

        expect(content).not.toContain("extends");
        expect(content).toContain("export class ExtendedString {");
      });
    });

    test("handles extension without base attribute", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="NoBaseExtension">
    <xsd:complexContent>
      <xsd:extension>
        <xsd:sequence>
          <xsd:element name="field" type="xsd:string"/>
        </xsd:sequence>
      </xsd:extension>
    </xsd:complexContent>
  </xsd:complexType>
  <xsd:element name="NoBaseExtension" type="NoBaseExtension"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(
          path.join(tmp, "NoBaseExtension.ts"),
          "utf8"
        );

        expect(content).not.toContain("extends");
        expect(content).toContain("export class NoBaseExtension {");
      });
    });
  });

  describe("namespace handling in @XmlRoot", () => {
    test("includes namespace and prefixes in @XmlRoot decorator", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
            xmlns:ns="http://example.com/ns"
            targetNamespace="http://example.com/target">
  <xsd:complexType name="NamespacedType">
    <xsd:sequence>
      <xsd:element name="field" type="xsd:string"/>
    </xsd:sequence>
  </xsd:complexType>
  <xsd:element name="NamespacedType" type="NamespacedType"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(
          path.join(tmp, "NamespacedType.ts"),
          "utf8"
        );

        expect(content).toContain("namespace: 'http://example.com/target'");
      });
    });

    test("@XmlRoot without namespace when no targetNamespace", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="NoNamespace">
    <xsd:sequence>
      <xsd:element name="field" type="xsd:string"/>
    </xsd:sequence>
  </xsd:complexType>
  <xsd:element name="NoNamespace" type="NoNamespace"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(path.join(tmp, "NoNamespace.ts"), "utf8");

        expect(content).not.toContain("namespace:");
        expect(content).toContain("@XmlRoot('NoNamespace')");
      });
    });
  });

  describe("empty complexContent", () => {
    test("handles complexContent with neither extension nor restriction", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="EmptyComplexContent">
    <xsd:complexContent>
    </xsd:complexContent>
  </xsd:complexType>
  <xsd:element name="EmptyComplexContent" type="EmptyComplexContent"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(
          path.join(tmp, "EmptyComplexContent.ts"),
          "utf8"
        );

        expect(content).toContain("export class EmptyComplexContent {");
      });
    });
  });
});
