import { generateFromXsd } from "../src/xsd/TsGenerator";
import { readFileSync, mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";

describe("XSD Generator advanced features", () => {
  function withTmpDir(run: (dir: string) => void) {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "xmlbind-ts-adv-"));
    try {
      run(tmpDir);
    } finally {
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }

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
      expect(person).toMatch(
        /@XmlElement\('address',\s*\{\s*type:\s*Address,\s*namespace:\s*'http:\/\/example.com\/ns'\s*\}\)/
      );
      expect(person).toMatch(/address\?:\s*Address;/);
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
});
