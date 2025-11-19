import { generateFromXsd } from "../src/xsd/TsGenerator";
import { readFileSync } from "fs";

import path from "path";
import { withTmpDir } from "./test-utils/temp-dir";

describe("XSD Generator - Multiple schemas with imports and cross-namespace references", () => {

  test("handles schema with import and type reference from imported namespace", () => {
    const ADDRESS_XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
            targetNamespace="http://example.com/address" 
            elementFormDefault="qualified">
  <xsd:complexType name="Address">
    <xsd:sequence>
      <xsd:element name="street" type="xsd:string"/>
      <xsd:element name="city" type="xsd:string"/>
      <xsd:element name="zipCode" type="xsd:string"/>
    </xsd:sequence>
  </xsd:complexType>
</xsd:schema>`;

    const PERSON_XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"
            xmlns:addr="http://example.com/address"
            targetNamespace="http://example.com/person"
            elementFormDefault="qualified">
  <xsd:import namespace="http://example.com/address" schemaLocation="address.xsd"/>
  
  <xsd:complexType name="Person">
    <xsd:sequence>
      <xsd:element name="name" type="xsd:string"/>
      <xsd:element name="age" type="xsd:int"/>
      <xsd:element name="homeAddress" type="addr:Address"/>
    </xsd:sequence>
  </xsd:complexType>
</xsd:schema>`;

    withTmpDir((tmp) => {
      // Generate from address schema
      generateFromXsd(ADDRESS_XSD, tmp);
      const addressFile = readFileSync(path.join(tmp, "Address.ts"), "utf8");
      expect(addressFile).toContain("export class Address");
      expect(addressFile).toContain("@XmlRoot('Address'");
      expect(addressFile).toContain("namespace: 'http://example.com/address'");

      // Generate from person schema
      generateFromXsd(PERSON_XSD, tmp);
      const personFile = readFileSync(path.join(tmp, "Person.ts"), "utf8");
      expect(personFile).toContain("export class Person");
      expect(personFile).toContain("@XmlRoot('Person'");
      expect(personFile).toContain("namespace: 'http://example.com/person'");
      expect(personFile).toContain("import { Address } from './Address';");
      expect(personFile).toMatch(
        /@XmlElement\('homeAddress',\s*\{\s*type:\s*Address/
      );
        expect(personFile).toMatch(/homeAddress!?:\s*Address;/);

      // Check that imported namespace prefix is included
      expect(personFile).toContain("'http://example.com/address': 'addr'");
    });
  });

  test("handles multiple imports with element references across namespaces", () => {
    const CONTACT_XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"
            targetNamespace="http://example.com/contact"
            elementFormDefault="qualified">
  <xsd:complexType name="Email">
    <xsd:sequence>
      <xsd:element name="address" type="xsd:string"/>
      <xsd:element name="isPrimary" type="xsd:boolean"/>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:complexType name="Phone">
    <xsd:sequence>
      <xsd:element name="number" type="xsd:string"/>
      <xsd:element name="type" type="xsd:string"/>
    </xsd:sequence>
  </xsd:complexType>
</xsd:schema>`;

    const COMPANY_XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"
            xmlns:cnt="http://example.com/contact"
            targetNamespace="http://example.com/company"
            elementFormDefault="qualified">
  <xsd:import namespace="http://example.com/contact" schemaLocation="contact.xsd"/>
  
  <xsd:complexType name="Department">
    <xsd:sequence>
      <xsd:element name="name" type="xsd:string"/>
      <xsd:element name="contactEmail" type="cnt:Email"/>
      <xsd:element name="contactPhone" type="cnt:Phone"/>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:complexType name="Company">
    <xsd:sequence>
      <xsd:element name="companyName" type="xsd:string"/>
      <xsd:element name="departments" type="Department" maxOccurs="unbounded"/>
    </xsd:sequence>
  </xsd:complexType>
</xsd:schema>`;

    withTmpDir((tmp) => {
      // Generate contact types
      generateFromXsd(CONTACT_XSD, tmp);

      const emailFile = readFileSync(path.join(tmp, "Email.ts"), "utf8");
      expect(emailFile).toContain("export class Email");

      const phoneFile = readFileSync(path.join(tmp, "Phone.ts"), "utf8");
      expect(phoneFile).toContain("export class Phone");

      // Generate company types
      generateFromXsd(COMPANY_XSD, tmp);

      const deptFile = readFileSync(path.join(tmp, "Department.ts"), "utf8");
      expect(deptFile).toContain("export class Department");
      expect(deptFile).toContain("import { Email } from './Email';");
      expect(deptFile).toContain("import { Phone } from './Phone';");
  expect(deptFile).toMatch(/contactEmail!?:\s*Email;/);
  expect(deptFile).toMatch(/contactPhone!?:\s*Phone;/);

      const companyFile = readFileSync(path.join(tmp, "Company.ts"), "utf8");
      expect(companyFile).toContain("export class Company");
      expect(companyFile).toContain(
        "import { Department } from './Department';"
      );
  expect(companyFile).toMatch(/departments!?:\s*Department\[\];/);
    });
  });

  test("handles nested imports with three different namespaces", () => {
    const CORE_XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"
            targetNamespace="http://example.com/core"
            elementFormDefault="qualified">
  <xsd:complexType name="Identifier">
    <xsd:sequence>
      <xsd:element name="id" type="xsd:string"/>
      <xsd:element name="version" type="xsd:int"/>
    </xsd:sequence>
  </xsd:complexType>
</xsd:schema>`;

    const METADATA_XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"
            xmlns:core="http://example.com/core"
            targetNamespace="http://example.com/metadata"
            elementFormDefault="qualified">
  <xsd:import namespace="http://example.com/core" schemaLocation="core.xsd"/>
  
  <xsd:complexType name="Metadata">
    <xsd:sequence>
      <xsd:element name="identifier" type="core:Identifier"/>
      <xsd:element name="created" type="xsd:dateTime"/>
      <xsd:element name="modified" type="xsd:dateTime"/>
    </xsd:sequence>
  </xsd:complexType>
</xsd:schema>`;

    const DOCUMENT_XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"
            xmlns:core="http://example.com/core"
            xmlns:meta="http://example.com/metadata"
            targetNamespace="http://example.com/document"
            elementFormDefault="qualified">
  <xsd:import namespace="http://example.com/core" schemaLocation="core.xsd"/>
  <xsd:import namespace="http://example.com/metadata" schemaLocation="metadata.xsd"/>
  
  <xsd:complexType name="Document">
    <xsd:sequence>
      <xsd:element name="docId" type="core:Identifier"/>
      <xsd:element name="meta" type="meta:Metadata"/>
      <xsd:element name="title" type="xsd:string"/>
      <xsd:element name="content" type="xsd:string"/>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="Document" type="Document"/>
</xsd:schema>`;

    withTmpDir((tmp) => {
      // Generate core types
      generateFromXsd(CORE_XSD, tmp);
      const identifierFile = readFileSync(
        path.join(tmp, "Identifier.ts"),
        "utf8"
      );
      expect(identifierFile).toContain("export class Identifier");
      expect(identifierFile).toContain("namespace: 'http://example.com/core'");

      // Generate metadata types
      generateFromXsd(METADATA_XSD, tmp);
      const metadataFile = readFileSync(path.join(tmp, "Metadata.ts"), "utf8");
      expect(metadataFile).toContain("export class Metadata");
      expect(metadataFile).toContain(
        "import { Identifier } from './Identifier';"
      );
      expect(metadataFile).toMatch(/identifier!?:\s*Identifier;/);
      // Generate document types
      generateFromXsd(DOCUMENT_XSD, tmp);

      // Since element name matches complexType name, we get Document.ts and DocumentElement.ts
      const documentTypeFile = readFileSync(
        path.join(tmp, "Document.ts"),
        "utf8"
      );
      expect(documentTypeFile).toContain("export class Document");
      expect(documentTypeFile).toContain(
        "namespace: 'http://example.com/document'"
      );
      expect(documentTypeFile).toContain("'http://example.com/core': 'core'");
      expect(documentTypeFile).toContain(
        "'http://example.com/metadata': 'meta'"
      );
      expect(documentTypeFile).toContain(
        "import { Identifier } from './Identifier';"
      );
      expect(documentTypeFile).toContain(
        "import { Metadata } from './Metadata';"
      );
      expect(documentTypeFile).toMatch(/docId!?:\s*Identifier;/);
      expect(documentTypeFile).toMatch(/meta!?:\s*Metadata;/);
      // DocumentElement wraps the Document type
      const documentElementFile = readFileSync(
        path.join(tmp, "DocumentElement.ts"),
        "utf8"
      );
      expect(documentElementFile).toContain(
        "export class DocumentElement extends Document"
      );
      expect(documentElementFile).toContain("@XmlRoot('Document'");
    });
  });

  test("handles schema with element references to imported elements", () => {
    const BASE_XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"
            targetNamespace="http://example.com/base"
            elementFormDefault="qualified">
  <xsd:element name="CommonHeader">
    <xsd:complexType>
      <xsd:sequence>
        <xsd:element name="timestamp" type="xsd:dateTime"/>
        <xsd:element name="source" type="xsd:string"/>
      </xsd:sequence>
    </xsd:complexType>
  </xsd:element>
  
  <xsd:complexType name="Status">
    <xsd:sequence>
      <xsd:element name="code" type="xsd:int"/>
      <xsd:element name="message" type="xsd:string"/>
    </xsd:sequence>
  </xsd:complexType>
</xsd:schema>`;

    const MESSAGE_XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"
            xmlns:base="http://example.com/base"
            targetNamespace="http://example.com/message"
            elementFormDefault="qualified">
  <xsd:import namespace="http://example.com/base" schemaLocation="base.xsd"/>
  
  <xsd:complexType name="Message">
    <xsd:sequence>
      <xsd:element ref="base:CommonHeader"/>
      <xsd:element name="body" type="xsd:string"/>
      <xsd:element name="status" type="base:Status"/>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="Message" type="Message"/>
</xsd:schema>`;

    withTmpDir((tmp) => {
      // Generate base types
      generateFromXsd(BASE_XSD, tmp);
      const headerFile = readFileSync(
        path.join(tmp, "CommonHeader.ts"),
        "utf8"
      );
      expect(headerFile).toContain("export class CommonHeader");

      const statusFile = readFileSync(path.join(tmp, "Status.ts"), "utf8");
      expect(statusFile).toContain("export class Status");

      // Generate message types
      generateFromXsd(MESSAGE_XSD, tmp);
      const messageTypeFile = readFileSync(
        path.join(tmp, "Message.ts"),
        "utf8"
      );
  expect(messageTypeFile).toContain("export class Message");
  expect(messageTypeFile).toContain("import { Status } from './Status';");
  expect(messageTypeFile).toMatch(/status!?:\s*Status;/);
    });
  });

  test("handles circular dependencies between namespaces", () => {
    const ORDER_XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"
            xmlns:cust="http://example.com/customer"
            targetNamespace="http://example.com/order"
            elementFormDefault="qualified">
  <xsd:import namespace="http://example.com/customer" schemaLocation="customer.xsd"/>
  
  <xsd:complexType name="Order">
    <xsd:sequence>
      <xsd:element name="orderId" type="xsd:string"/>
      <xsd:element name="amount" type="xsd:decimal"/>
      <xsd:element name="customer" type="cust:Customer"/>
    </xsd:sequence>
  </xsd:complexType>
</xsd:schema>`;

    const CUSTOMER_XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"
            xmlns:ord="http://example.com/order"
            targetNamespace="http://example.com/customer"
            elementFormDefault="qualified">
  <xsd:import namespace="http://example.com/order" schemaLocation="order.xsd"/>
  
  <xsd:complexType name="Customer">
    <xsd:sequence>
      <xsd:element name="customerId" type="xsd:string"/>
      <xsd:element name="name" type="xsd:string"/>
      <xsd:element name="recentOrders" type="ord:Order" maxOccurs="unbounded" minOccurs="0"/>
    </xsd:sequence>
  </xsd:complexType>
</xsd:schema>`;

    withTmpDir((tmp) => {
      // Generate order types first
      generateFromXsd(ORDER_XSD, tmp);
      const orderFile = readFileSync(path.join(tmp, "Order.ts"), "utf8");
      expect(orderFile).toContain("export class Order");
      expect(orderFile).toContain("import { Customer } from './Customer';");

      // Generate customer types
      generateFromXsd(CUSTOMER_XSD, tmp);
      const customerFile = readFileSync(path.join(tmp, "Customer.ts"), "utf8");
      expect(customerFile).toContain("export class Customer");
      expect(customerFile).toContain("import { Order } from './Order';");
      expect(customerFile).toMatch(/recentOrders\?:\s*Order\[\];/);
    });
  });
});
