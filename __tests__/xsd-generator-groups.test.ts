import { generateFromXsd } from "../src/xsd/TsGenerator";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { withTmpDir, expectStringsOnConsecutiveLines } from "./test-utils";

describe("XSD Generator - Groups", () => {
  test("generates classes with group references", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:group name="AddressGroup">
    <xs:sequence>
      <xs:element name="street" type="xs:string"/>
      <xs:element name="city" type="xs:string"/>
      <xs:element name="zipCode" type="xs:string"/>
    </xs:sequence>
  </xs:group>
  
  <xs:complexType name="PersonType">
    <xs:sequence>
      <xs:element name="name" type="xs:string"/>
      <xs:group ref="AddressGroup"/>
      <xs:element name="phone" type="xs:string" minOccurs="0"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:element name="Person" type="PersonType"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      const personFile = path.join(dir, "PersonType.ts");
      expect(existsSync(personFile)).toBe(true);

      const content = readFileSync(personFile, "utf-8");

      // Should have all elements from the group reference
      expect(content).toContain("@XmlElement('name'");
      expect(content).toContain("@XmlElement('street'");
      expect(content).toContain("@XmlElement('city'");
      expect(content).toContain("@XmlElement('zipCode'");
      expect(content).toContain("@XmlElement('phone'");

      // Required group elements are non-optional; optional phone stays optional
      expect(content).toMatch(/\bname!?:/);
      expect(content).toMatch(/\bstreet!?:/);
      expect(content).toMatch(/\bcity!?:/);
      expect(content).toMatch(/\bzipCode!?:/);
      expect(content).toContain("phone?:");
    });
  });

  test("handles nested group references", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:group name="ContactGroup">
    <xs:sequence>
      <xs:element name="email" type="xs:string"/>
      <xs:element name="phone" type="xs:string"/>
    </xs:sequence>
  </xs:group>
  
  <xs:group name="PersonInfoGroup">
    <xs:sequence>
      <xs:element name="firstName" type="xs:string"/>
      <xs:element name="lastName" type="xs:string"/>
      <xs:group ref="ContactGroup"/>
    </xs:sequence>
  </xs:group>
  
  <xs:complexType name="Employee">
    <xs:sequence>
      <xs:group ref="PersonInfoGroup"/>
      <xs:element name="employeeId" type="xs:string"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:element name="Employee" type="Employee"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      const employeeFile = path.join(dir, "Employee.ts");
      expect(existsSync(employeeFile)).toBe(true);

      const content = readFileSync(employeeFile, "utf-8");

      // Should have all elements from nested groups
      expect(content).toContain("@XmlElement('firstName'");
      expect(content).toContain("@XmlElement('lastName'");
      expect(content).toContain("@XmlElement('email'");
      expect(content).toContain("@XmlElement('phone'");
      expect(content).toContain("@XmlElement('employeeId'");
    });
  });

  test("handles groups with choice compositor", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:group name="PaymentMethodGroup">
    <xs:choice>
      <xs:element name="creditCard" type="xs:string"/>
      <xs:element name="bankTransfer" type="xs:string"/>
      <xs:element name="cash" type="xs:string"/>
    </xs:choice>
  </xs:group>
  
  <xs:complexType name="Order">
    <xs:sequence>
      <xs:element name="orderId" type="xs:string"/>
      <xs:group ref="PaymentMethodGroup"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:element name="Order" type="Order"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      const orderFile = path.join(dir, "Order.ts");
      expect(existsSync(orderFile)).toBe(true);

      const content = readFileSync(orderFile, "utf-8");

      // Should have all choice elements
      expect(content).toContain("@XmlElement('orderId'");
      expect(content).toContain("@XmlElement('creditCard'");
      expect(content).toContain("@XmlElement('bankTransfer'");
      expect(content).toContain("@XmlElement('cash'");
    });
  });

  test("handles group references with maxOccurs > 1", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:group name="ItemGroup">
    <xs:choice>
      <xs:element name="product" type="xs:string"/>
      <xs:element name="service" type="xs:string"/>
      <xs:element name="discount" type="xs:string"/>
    </xs:choice>
  </xs:group>
  
  <xs:complexType name="ShoppingCart">
    <xs:sequence>
      <xs:element name="cartId" type="xs:string"/>
      <xs:group ref="ItemGroup" minOccurs="0" maxOccurs="unbounded"/>
      <xs:element name="total" type="xs:decimal"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:element name="ShoppingCart" type="ShoppingCart"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      const cartFile = path.join(dir, "ShoppingCart.ts");
      expect(existsSync(cartFile)).toBe(true);

      const content = readFileSync(cartFile, "utf-8");

      // Elements from the group should be arrays because maxOccurs="unbounded"
      expectStringsOnConsecutiveLines(content, [
        "@XmlElement('product', { type: String, array: true })",
        "product?: string[];",
      ]);

      expectStringsOnConsecutiveLines(content, [
        "@XmlElement('service', { type: String, array: true })",
        "service?: string[];",
      ]);

      expectStringsOnConsecutiveLines(content, [
        "@XmlElement('discount', { type: String, array: true })",
        "discount?: string[];",
      ]);

      // Regular elements should not be arrays
      expectStringsOnConsecutiveLines(content, [
        "@XmlElement('cartId', { type: String })",
        "cartId!: string;",
      ]);

      expectStringsOnConsecutiveLines(content, [
        "@XmlElement('total', { type: Number })",
        "total!: number;",
      ]);
    });
  });

  test("handles group references with minOccurs=0", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:group name="OptionalInfoGroup">
    <xs:sequence>
      <xs:element name="notes" type="xs:string"/>
      <xs:element name="comments" type="xs:string"/>
    </xs:sequence>
  </xs:group>
  
  <xs:complexType name="Document">
    <xs:sequence>
      <xs:element name="title" type="xs:string"/>
      <xs:group ref="OptionalInfoGroup" minOccurs="0"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:element name="Document" type="Document"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      const docFile = path.join(dir, "Document.ts");
      expect(existsSync(docFile)).toBe(true);

      const content = readFileSync(docFile, "utf-8");

      // Elements from the optional group should be optional
      expectStringsOnConsecutiveLines(content, [
        "@XmlElement('notes', { type: String })",
        "notes?: string;",
      ]);

      expectStringsOnConsecutiveLines(content, [
        "@XmlElement('comments', { type: String })",
        "comments?: string;",
      ]);

      // Title should be required
      expectStringsOnConsecutiveLines(content, [
        "@XmlElement('title', { type: String })",
        "title!: string;",
      ]);
    });
  });

  test("handles group references with both minOccurs=0 and maxOccurs > 1", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:group name="TagGroup">
    <xs:sequence>
      <xs:element name="tag" type="xs:string"/>
      <xs:element name="category" type="xs:string"/>
    </xs:sequence>
  </xs:group>
  
  <xs:complexType name="Article">
    <xs:sequence>
      <xs:element name="id" type="xs:string"/>
      <xs:group ref="TagGroup" minOccurs="0" maxOccurs="5"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:element name="Article" type="Article"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      const articleFile = path.join(dir, "Article.ts");
      expect(existsSync(articleFile)).toBe(true);

      const content = readFileSync(articleFile, "utf-8");

      // Elements from the group should be optional arrays
      expectStringsOnConsecutiveLines(content, [
        "@XmlElement('tag', { type: String, array: true })",
        "tag?: string[];",
      ]);

      expectStringsOnConsecutiveLines(content, [
        "@XmlElement('category', { type: String, array: true })",
        "category?: string[];",
      ]);

      // ID should be required and not an array
      expectStringsOnConsecutiveLines(content, [
        "@XmlElement('id', { type: String })",
        "id!: string;",
      ]);
    });
  });
});
