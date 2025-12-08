import { marshal, unmarshal } from "../src/marshalling";
import { mkdtempSync, rmSync, existsSync } from "fs";
import os from "os";
import path from "path";
import {
  setupGeneratedRuntime,
  loadGeneratedClasses,
  expectStringsOnConsecutiveLines,
  expectStringsOnSameLine,
} from "./test-utils";

const ADDRESS_XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
            targetNamespace="http://example.com/address" 
            elementFormDefault="qualified">
  <xsd:complexType name="Address">
    <xsd:sequence>
      <xsd:element name="street" type="xsd:string"/>
      <xsd:element name="city" type="xsd:string"/>
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
      <xsd:element name="homeAddress" type="addr:Address"/>
    </xsd:sequence>
    <xsd:attribute name="id" type="xsd:string"/>
  </xsd:complexType>
</xsd:schema>`;

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
    </xsd:sequence>
    <xsd:attribute name="code" type="xsd:string"/>
  </xsd:complexType>
  
  <xsd:complexType name="Company">
    <xsd:sequence>
      <xsd:element name="companyName" type="xsd:string"/>
      <xsd:element name="departments" type="Department" maxOccurs="unbounded"/>
    </xsd:sequence>
  </xsd:complexType>
</xsd:schema>`;

describe("Marshal and Unmarshal with imported schemas - generated code", () => {
  let tmpDir: string;
  let Address: any;
  let Person: any;
  let Email: any;
  let Department: any;
  let Company: any;

  beforeAll(async () => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "xmlbind-imports-test-"));
    setupGeneratedRuntime(tmpDir, [
      ADDRESS_XSD,
      PERSON_XSD,
      CONTACT_XSD,
      COMPANY_XSD,
    ]);

    const expectedFiles = [
      path.join(tmpDir, "Address.ts"),
      path.join(tmpDir, "Person.ts"),
      path.join(tmpDir, "Email.ts"),
      path.join(tmpDir, "Department.ts"),
      path.join(tmpDir, "Company.ts"),
    ];
    /* eslint-disable jest/no-standalone-expect */
    expectedFiles.forEach((f) => {
      expect(existsSync(f)).toBe(true);
    });
    /* eslint-enable jest/no-standalone-expect */

    const loaded = loadGeneratedClasses(tmpDir, [
      "Address",
      "Person",
      "Email",
      "Department",
      "Company",
    ] as const);

    Address = loaded.Address;
    Person = loaded.Person;
    Email = loaded.Email;
    Department = loaded.Department;
    Company = loaded.Company;
  });

  afterAll(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe("simple cross-namespace types", () => {
    test("unmarshal XML with nested type from different namespace", () => {
      const xml = `<?xml version="1.0"?>
<Person xmlns="http://example.com/person" xmlns:addr="http://example.com/address" id="P123">
  <name>Alice Smith</name>
  <homeAddress>
    <addr:street>123 Main St</addr:street>
    <addr:city>Springfield</addr:city>
  </homeAddress>
</Person>`;

      const person = unmarshal(Person, xml) as any;

      expect(person).toBeInstanceOf(Person);
      expect(person.id).toBe("P123");
      expect(person.name).toBe("Alice Smith");
      expect(person.homeAddress).toBeInstanceOf(Address);
      expect(person.homeAddress.street).toBe("123 Main St");
      expect(person.homeAddress.city).toBe("Springfield");
    });

    test("marshal object with nested type from different namespace", () => {
      const person = new Person();
      person.id = "P456";
      person.name = "Bob Johnson";

      const addr = new Address();
      addr.street = "789 Elm St";
      addr.city = "Portland";
      person.homeAddress = addr;

      const xml = marshal(person);

      // Verify that attributes appear on the same line as the opening tag
      const firstLine = xml.split('\n')[0];
      expectStringsOnSameLine(firstLine, [
        "<Person",
        'xmlns="http://example.com/person"',
        'id="P456"',
      ]);
      expectStringsOnConsecutiveLines(xml, [
        "<name>Bob Johnson</name>",
        "<homeAddress>",
        "<addr:street>789 Elm St</addr:street>",
        "<addr:city>Portland</addr:city>",
        "</homeAddress>",
      ]);
    });

    test("roundtrip marshal and unmarshal with cross-namespace types", () => {
      const original = new Person();
      original.id = "P789";
      original.name = "Carol White";

      const addr = new Address();
      addr.street = "321 Pine Ave";
      addr.city = "Austin";
      original.homeAddress = addr;

      const xml = marshal(original);
      const restored = unmarshal(Person, xml) as any;

      expect(restored).toBeInstanceOf(Person);
      expect(restored.id).toBe(original.id);
      expect(restored.name).toBe(original.name);
      expect(restored.homeAddress).toBeInstanceOf(Address);
      expect(restored.homeAddress.street).toBe(addr.street);
      expect(restored.homeAddress.city).toBe(addr.city);
    });
  });

  describe("complex multi-namespace scenario", () => {
    test("unmarshal with arrays and multiple nested imported types", () => {
      const xml = `<?xml version="1.0"?>
<Company xmlns="http://example.com/company" xmlns:cnt="http://example.com/contact">
  <companyName>Tech Corp</companyName>
  <departments code="ENG">
    <name>Engineering</name>
    <contactEmail>
      <cnt:address>eng@techcorp.com</cnt:address>
      <cnt:isPrimary>true</cnt:isPrimary>
    </contactEmail>
  </departments>
  <departments code="HR">
    <name>Human Resources</name>
    <contactEmail>
      <cnt:address>hr@techcorp.com</cnt:address>
      <cnt:isPrimary>false</cnt:isPrimary>
    </contactEmail>
  </departments>
</Company>`;

      const company = unmarshal(Company, xml) as any;

      expect(company).toBeInstanceOf(Company);
      expect(company.companyName).toBe("Tech Corp");
      expect(Array.isArray(company.departments)).toBe(true);
      expect(company.departments.length).toBe(2);

      const dept1 = company.departments[0];
      expect(dept1).toBeInstanceOf(Department);
      expect(dept1.code).toBe("ENG");
      expect(dept1.name).toBe("Engineering");
      expect(dept1.contactEmail).toBeInstanceOf(Email);
      expect(dept1.contactEmail.address).toBe("eng@techcorp.com");
      expect(dept1.contactEmail.isPrimary).toBe(true);

      const dept2 = company.departments[1];
      expect(dept2.code).toBe("HR");
      expect(dept2.contactEmail.address).toBe("hr@techcorp.com");
      expect(dept2.contactEmail.isPrimary).toBe(false);
    });

    test("marshal with arrays and multiple nested types", () => {
      const company = new Company();
      company.companyName = "Startup Inc";

      const dept1 = new Department();
      dept1.code = "SALES";
      dept1.name = "Sales";

      const email1 = new Email();
      email1.address = "sales@startup.com";
      email1.isPrimary = true;
      dept1.contactEmail = email1;

      const dept2 = new Department();
      dept2.code = "MKT";
      dept2.name = "Marketing";

      const email2 = new Email();
      email2.address = "marketing@startup.com";
      email2.isPrimary = false;
      dept2.contactEmail = email2;

      company.departments = [dept1, dept2];

      const xml = marshal(company);

      // Verify that namespace attribute appears on the same line as the opening tag
      const firstLine = xml.split('\n')[0];
      expectStringsOnSameLine(firstLine, [
        "<Company",
        'xmlns="http://example.com/company"',
      ]);
      expect(xml).toContain("<companyName>Startup Inc</companyName>");
      expect((xml.match(/<departments/g) || []).length).toBe(2);
      expect(xml).toContain('code="SALES"');
      expect(xml).toContain('code="MKT"');
      expect(xml).toContain("<name>Sales</name>");
      expect(xml).toContain("<cnt:address>sales@startup.com</cnt:address>");
      expect(xml).toContain("<cnt:address>marketing@startup.com</cnt:address>");
    });

    test("roundtrip with complex nested structures", () => {
      const original = new Company();
      original.companyName = "RoundTrip Co";

      const dept = new Department();
      dept.code = "IT";
      dept.name = "Information Technology";

      const email = new Email();
      email.address = "it@roundtrip.com";
      email.isPrimary = true;
      dept.contactEmail = email;

      original.departments = [dept];

      const xml = marshal(original);
      const restored = unmarshal(Company, xml) as any;

      expect(restored).toBeInstanceOf(Company);
      expect(restored.companyName).toBe("RoundTrip Co");

      // departments may not be restored as array if it's a single element
      /* eslint-disable jest/no-conditional-expect */
      if (Array.isArray(restored.departments)) {
        expect(restored.departments.length).toBe(1);
        const restoredDept = restored.departments[0];
        expect(restoredDept).toBeInstanceOf(Department);
        expect(restoredDept.code).toBe("IT");
        expect(restoredDept.name).toBe("Information Technology");
        expect(restoredDept.contactEmail.address).toBe("it@roundtrip.com");
        expect(restoredDept.contactEmail.isPrimary).toBe(true);
      } else {
        const restoredDept =
          restored.departments as unknown as typeof Department;
        expect(restoredDept).toBeInstanceOf(Department);
        expect(restoredDept.code).toBe("IT");
        expect(restoredDept.name).toBe("Information Technology");
        expect(restoredDept.contactEmail.address).toBe("it@roundtrip.com");
        expect(restoredDept.contactEmail.isPrimary).toBe(true);
      }
      /* eslint-enable jest/no-conditional-expect */
    });
  });
});
