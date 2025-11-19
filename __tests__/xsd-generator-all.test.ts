import { generateFromXsd } from "../src/xsd/TsGenerator";
import * as fs from "fs";
import * as path from "path";
import { withTmpDir } from "./test-utils/temp-dir";



describe("XSD Generator - xs:all Compositor", () => {
  test("generates class with xs:all elements", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:complexType name="Person">
    <xs:all>
      <xs:element name="firstName" type="xs:string"/>
      <xs:element name="lastName" type="xs:string"/>
      <xs:element name="email" type="xs:string"/>
    </xs:all>
  </xs:complexType>
  
  <xs:element name="PersonData" type="Person"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      const personFile = path.join(dir, "Person.ts");
      expect(fs.existsSync(personFile)).toBe(true);

      const content = fs.readFileSync(personFile, "utf-8");

      // Should have all elements from xs:all
      expect(content).toContain("@XmlElement('firstName'");
      expect(content).toContain("@XmlElement('lastName'");
      expect(content).toContain("@XmlElement('email'");

  // Elements in xs:all are required by default -> non-optional
  expect(content).toMatch(/firstName!?:\s*String/);
  expect(content).toMatch(/lastName!?:\s*String/);
  expect(content).toMatch(/email!?:\s*String/);
    });
  });

  test("handles xs:all with optional elements", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:complexType name="Contact">
    <xs:all>
      <xs:element name="phone" type="xs:string" minOccurs="0"/>
      <xs:element name="email" type="xs:string" minOccurs="0"/>
      <xs:element name="address" type="xs:string" minOccurs="0"/>
    </xs:all>
  </xs:complexType>
  
  <xs:element name="ContactInfo" type="Contact"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      const contactFile = path.join(dir, "Contact.ts");
      const content = fs.readFileSync(contactFile, "utf-8");

      // All elements should be optional (marked with ?)
      expect(content).toContain("phone?: String");
      expect(content).toContain("email?: String");
      expect(content).toContain("address?: String");
    });
  });

  test("handles xs:all with attributes", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:complexType name="Product">
    <xs:all>
      <xs:element name="name" type="xs:string"/>
      <xs:element name="price" type="xs:decimal"/>
    </xs:all>
    <xs:attribute name="id" type="xs:string"/>
  </xs:complexType>
  
  <xs:element name="ProductData" type="Product"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      const productFile = path.join(dir, "Product.ts");
      const content = fs.readFileSync(productFile, "utf-8");

      // Should have elements from xs:all
      expect(content).toContain("@XmlElement('name'");
      expect(content).toContain("@XmlElement('price'");

      // And the attribute
      expect(content).toContain("@XmlAttribute('id'");
    });
  });
});
