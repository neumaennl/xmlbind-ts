import { generateFromXsd } from "../src/xsd/TsGenerator";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

function withTmpDir(fn: (dir: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xmlbind-groups-"));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

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
      expect(fs.existsSync(personFile)).toBe(true);

      const content = fs.readFileSync(personFile, "utf-8");

      // Should have all elements from the group reference
      expect(content).toContain("@XmlElement('name'");
      expect(content).toContain("@XmlElement('street'");
      expect(content).toContain("@XmlElement('city'");
      expect(content).toContain("@XmlElement('zipCode'");
      expect(content).toContain("@XmlElement('phone'");

      // Should have properties for all elements
      expect(content).toContain("name?:");
      expect(content).toContain("street?:");
      expect(content).toContain("city?:");
      expect(content).toContain("zipCode?:");
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
      expect(fs.existsSync(employeeFile)).toBe(true);

      const content = fs.readFileSync(employeeFile, "utf-8");

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
      expect(fs.existsSync(orderFile)).toBe(true);

      const content = fs.readFileSync(orderFile, "utf-8");

      // Should have all choice elements
      expect(content).toContain("@XmlElement('orderId'");
      expect(content).toContain("@XmlElement('creditCard'");
      expect(content).toContain("@XmlElement('bankTransfer'");
      expect(content).toContain("@XmlElement('cash'");
    });
  });
});
