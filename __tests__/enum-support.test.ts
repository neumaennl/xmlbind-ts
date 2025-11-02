import { generateFromXsd } from "../src/xsd/TsGenerator";
import { readFileSync, mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";

describe("Enum support", () => {
  function withTmpDir(run: (dir: string) => void) {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "xmlbind-ts-enum-"));
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

  test("generates enum from named simpleType with restrictions", () => {
    const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com/ns" elementFormDefault="qualified">
  <xsd:simpleType name="ColorType">
    <xsd:restriction base="xsd:string">
      <xsd:enumeration value="red"/>
      <xsd:enumeration value="green"/>
      <xsd:enumeration value="blue"/>
    </xsd:restriction>
  </xsd:simpleType>
  <xsd:complexType name="Product">
    <xsd:sequence>
      <xsd:element name="name" type="xsd:string"/>
      <xsd:element name="color" type="ColorType"/>
    </xsd:sequence>
  </xsd:complexType>
</xsd:schema>`;

    withTmpDir((tmp) => {
      generateFromXsd(XSD, tmp);

      // Check that ColorType enum was generated
      const colorTypeFile = path.join(tmp, "ColorType.ts");
      expect(readFileSync(colorTypeFile, "utf8")).toContain(
        "export enum ColorType"
      );
      const colorTypeContent = readFileSync(colorTypeFile, "utf8");
      expect(colorTypeContent).toContain('red = "red"');
      expect(colorTypeContent).toContain('green = "green"');
      expect(colorTypeContent).toContain('blue = "blue"');

      // Check that Product class references ColorType
      const productFile = path.join(tmp, "Product.ts");
      const productContent = readFileSync(productFile, "utf8");
      expect(productContent).toContain(
        "import { ColorType } from './ColorType';"
      );
      expect(productContent).toMatch(
        /@XmlElement\('color',\s*\{\s*type:\s*ColorType,\s*namespace:\s*'http:\/\/example.com\/ns'\s*\}\)/
      );
      expect(productContent).toMatch(/color!?:\s*ColorType;/);
    });
  });

  test("generates inline enum for element with anonymous simpleType restriction", () => {
    const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com/ns" elementFormDefault="qualified">
  <xsd:complexType name="Order">
    <xsd:sequence>
      <xsd:element name="status">
        <xsd:simpleType>
          <xsd:restriction base="xsd:string">
            <xsd:enumeration value="pending"/>
            <xsd:enumeration value="shipped"/>
            <xsd:enumeration value="delivered"/>
          </xsd:restriction>
        </xsd:simpleType>
      </xsd:element>
    </xsd:sequence>
  </xsd:complexType>
</xsd:schema>`;

    withTmpDir((tmp) => {
      generateFromXsd(XSD, tmp);

      // Check that statusEnum was generated
      const statusEnumFile = path.join(tmp, "statusEnum.ts");
      expect(readFileSync(statusEnumFile, "utf8")).toContain(
        "export enum statusEnum"
      );
      const statusEnumContent = readFileSync(statusEnumFile, "utf8");
      expect(statusEnumContent).toContain('pending = "pending"');
      expect(statusEnumContent).toContain('shipped = "shipped"');
      expect(statusEnumContent).toContain('delivered = "delivered"');

      // Check that Order class references statusEnum
      const orderFile = path.join(tmp, "Order.ts");
      const orderContent = readFileSync(orderFile, "utf8");
      expect(orderContent).toContain(
        "import { statusEnum } from './statusEnum';"
      );
  expect(orderContent).toMatch(/status!?:\s*statusEnum;/);
    });
  });

  test("generates enum wrapper class for top-level element with enum type", () => {
    const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com/ns" elementFormDefault="qualified">
  <xsd:simpleType name="SizeType">
    <xsd:restriction base="xsd:string">
      <xsd:enumeration value="small"/>
      <xsd:enumeration value="medium"/>
      <xsd:enumeration value="large"/>
    </xsd:restriction>
  </xsd:simpleType>
  <xsd:element name="Size" type="SizeType"/>
</xsd:schema>`;

    withTmpDir((tmp) => {
      generateFromXsd(XSD, tmp);

      // Check that SizeType enum was generated
      const sizeTypeFile = path.join(tmp, "SizeType.ts");
      expect(readFileSync(sizeTypeFile, "utf8")).toContain(
        "export enum SizeType"
      );

      // Check that Size wrapper class was generated
      const sizeFile = path.join(tmp, "Size.ts");
      const sizeContent = readFileSync(sizeFile, "utf8");
      expect(sizeContent).toContain("import { SizeType } from './SizeType';");
      expect(sizeContent).toMatch(/@XmlRoot\('Size'/);
      expect(sizeContent).toContain("@XmlText()");
      expect(sizeContent).toMatch(/value\?:\s*SizeType;/);
    });
  });

  test("generates inline enum for top-level element with anonymous enum simpleType", () => {
    const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com/ns" elementFormDefault="qualified">
  <xsd:element name="Priority">
    <xsd:simpleType>
      <xsd:restriction base="xsd:string">
        <xsd:enumeration value="low"/>
        <xsd:enumeration value="medium"/>
        <xsd:enumeration value="high"/>
      </xsd:restriction>
    </xsd:simpleType>
  </xsd:element>
</xsd:schema>`;

    withTmpDir((tmp) => {
      generateFromXsd(XSD, tmp);

      // Check that PriorityEnum was generated
      const priorityEnumFile = path.join(tmp, "PriorityEnum.ts");
      expect(readFileSync(priorityEnumFile, "utf8")).toContain(
        "export enum PriorityEnum"
      );
      const priorityEnumContent = readFileSync(priorityEnumFile, "utf8");
      expect(priorityEnumContent).toContain('low = "low"');
      expect(priorityEnumContent).toContain('medium = "medium"');
      expect(priorityEnumContent).toContain('high = "high"');

      // Check that Priority wrapper class was generated
      const priorityFile = path.join(tmp, "Priority.ts");
      const priorityContent = readFileSync(priorityFile, "utf8");
      expect(priorityContent).toContain(
        "import { PriorityEnum } from './PriorityEnum';"
      );
      expect(priorityContent).toMatch(/@XmlRoot\('Priority'/);
      expect(priorityContent).toMatch(/value\?:\s*PriorityEnum;/);
    });
  });

  test("handles enum values with special characters", () => {
    const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com/ns" elementFormDefault="qualified">
  <xsd:simpleType name="SpecialType">
    <xsd:restriction base="xsd:string">
      <xsd:enumeration value="value-with-dash"/>
      <xsd:enumeration value="value.with.dot"/>
      <xsd:enumeration value="123numeric"/>
    </xsd:restriction>
  </xsd:simpleType>
</xsd:schema>`;

    withTmpDir((tmp) => {
      generateFromXsd(XSD, tmp);

      const specialTypeFile = path.join(tmp, "SpecialType.ts");
      const content = readFileSync(specialTypeFile, "utf8");

      // Keys should be sanitized but values should be original
      expect(content).toContain('value_with_dash = "value-with-dash"');
      expect(content).toContain('value_with_dot = "value.with.dot"');
      expect(content).toContain('_123numeric = "123numeric"');
    });
  });

  test("generates array of enum values", () => {
    const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com/ns" elementFormDefault="qualified">
  <xsd:simpleType name="TagType">
    <xsd:restriction base="xsd:string">
      <xsd:enumeration value="urgent"/>
      <xsd:enumeration value="important"/>
      <xsd:enumeration value="review"/>
    </xsd:restriction>
  </xsd:simpleType>
  <xsd:complexType name="Task">
    <xsd:sequence>
      <xsd:element name="title" type="xsd:string"/>
      <xsd:element name="tags" type="TagType" maxOccurs="unbounded" minOccurs="0"/>
    </xsd:sequence>
  </xsd:complexType>
</xsd:schema>`;

    withTmpDir((tmp) => {
      generateFromXsd(XSD, tmp);

      const taskFile = path.join(tmp, "Task.ts");
      const taskContent = readFileSync(taskFile, "utf8");

      expect(taskContent).toContain("import { TagType } from './TagType';");
      expect(taskContent).toMatch(
        /@XmlElement\('tags',\s*\{\s*type:\s*TagType,\s*array:\s*true,\s*namespace:\s*'http:\/\/example.com\/ns'\s*\}\)/
      );
  expect(taskContent).toMatch(/tags\?:\s*TagType\[\];/);
    });
  });
});
