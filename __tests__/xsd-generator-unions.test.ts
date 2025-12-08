import { generateFromXsd } from "../src/xsd/TsGenerator";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { withTmpDir } from "./test-utils/temp-dir";

describe("XSD Generator - Union Types", () => {
  test("generates type alias for union with memberTypes", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:simpleType name="StringOrNumber">
    <xs:union memberTypes="xs:string xs:integer"/>
  </xs:simpleType>
  
  <xs:element name="Value" type="StringOrNumber"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      // Types are now in consolidated types.ts file
      const typeFile = path.join(dir, "types.ts");
      expect(existsSync(typeFile)).toBe(true);

      const content = readFileSync(typeFile, "utf-8");

      // Should generate a union type
      expect(content).toContain("export type StringOrNumber");
      expect(content).toContain("string | number");
    });
  });

  test("handles union with multiple member types", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:simpleType name="MixedType">
    <xs:union memberTypes="xs:string xs:integer xs:boolean xs:date"/>
  </xs:simpleType>
  
  <xs:element name="MixedValue" type="MixedType"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      // Types are now in consolidated types.ts file
      const typeFile = path.join(dir, "types.ts");
      const content = readFileSync(typeFile, "utf-8");

      expect(content).toContain("string | number | boolean | Date");
    });
  });

  test("preserves literal members from inline enumerations", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:simpleType name="allNNI">
    <xs:union memberTypes="xs:nonNegativeInteger">
      <xs:simpleType>
        <xs:restriction base="xs:NMTOKEN">
          <xs:enumeration value="unbounded"/>
        </xs:restriction>
      </xs:simpleType>
    </xs:union>
  </xs:simpleType>

  <xs:element name="maxOccurs" type="allNNI"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      const typesContent = readFileSync(path.join(dir, "types.ts"), "utf-8");
      expect(typesContent).toContain(
        'export type allNNI = number | "unbounded"'
      );

      const enumsPath = path.join(dir, "enums.ts");
      if (existsSync(enumsPath)) {
        const enumsContent = readFileSync(enumsPath, "utf-8");
        expect(enumsContent).not.toContain("enum allNNI");
      }
    });
  });

  test("handles union with inline simpleType members", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:simpleType name="FlexibleType">
    <xs:union>
      <xs:simpleType>
        <xs:restriction base="xs:string"/>
      </xs:simpleType>
      <xs:simpleType>
        <xs:restriction base="xs:integer"/>
      </xs:simpleType>
    </xs:union>
  </xs:simpleType>
  
  <xs:element name="FlexValue" type="FlexibleType"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      // Types are now in consolidated types.ts file
      const typeFile = path.join(dir, "types.ts");
      expect(existsSync(typeFile)).toBe(true);

      const content = readFileSync(typeFile, "utf-8");
      expect(content).toContain("export type FlexibleType");
    });
  });

  describe("Inline union types in elements", () => {
    test("handles inline simpleType union with memberTypes", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="UnionType">
    <xsd:sequence>
      <xsd:element name="value">
        <xsd:simpleType>
          <xsd:union memberTypes="xsd:string xsd:integer xsd:boolean"/>
        </xsd:simpleType>
      </xsd:element>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="UnionType" type="UnionType"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(path.join(tmp, "UnionType.ts"), "utf8");

        expect(content).toContain("string | number | boolean");
      });
    });

    test("handles inline simpleType union with inline member types", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="ComplexUnion">
    <xsd:sequence>
      <xsd:element name="value">
        <xsd:simpleType>
          <xsd:union>
            <xsd:simpleType>
              <xsd:restriction base="xsd:string">
                <xsd:pattern value="[A-Z]+"/>
              </xsd:restriction>
            </xsd:simpleType>
            <xsd:simpleType>
              <xsd:restriction base="xsd:integer">
                <xsd:minInclusive value="0"/>
              </xsd:restriction>
            </xsd:simpleType>
          </xsd:union>
        </xsd:simpleType>
      </xsd:element>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="ComplexUnion" type="ComplexUnion"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(path.join(tmp, "ComplexUnion.ts"), "utf8");

        expect(content).toContain("string");
      });
    });

    test("handles empty union", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="EmptyUnion">
    <xsd:sequence>
      <xsd:element name="value">
        <xsd:simpleType>
          <xsd:union/>
        </xsd:simpleType>
      </xsd:element>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="EmptyUnion" type="EmptyUnion"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(path.join(tmp, "EmptyUnion.ts"), "utf8");

        expect(content).toContain("value!: any");
      });
    });
  });

  describe("Inline restrictions in elements", () => {
    test("handles inline simpleType restriction without enumeration", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="RestrictedString">
    <xsd:sequence>
      <xsd:element name="value">
        <xsd:simpleType>
          <xsd:restriction base="xsd:string">
            <xsd:maxLength value="10"/>
          </xsd:restriction>
        </xsd:simpleType>
      </xsd:element>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="RestrictedString" type="RestrictedString"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(
          path.join(tmp, "RestrictedString.ts"),
          "utf8"
        );

        expect(content).toContain("value!: string");
      });
    });

    test("handles inline simpleType restriction without base", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="UnbasedRestriction">
    <xsd:sequence>
      <xsd:element name="field">
        <xsd:simpleType>
          <xsd:restriction>
            <xsd:pattern value="[A-Z]+"/>
          </xsd:restriction>
        </xsd:simpleType>
      </xsd:element>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="UnbasedRestriction" type="UnbasedRestriction"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(
          path.join(tmp, "UnbasedRestriction.ts"),
          "utf8"
        );

        expect(content).toContain("field!: string");
      });
    });
  });
});
