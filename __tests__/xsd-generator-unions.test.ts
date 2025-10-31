import { generateFromXsd } from "../src/xsd/TsGenerator";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

function withTmpDir(fn: (dir: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xmlbind-unions-"));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

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

      const typeFile = path.join(dir, "StringOrNumber.ts");
      expect(fs.existsSync(typeFile)).toBe(true);

      const content = fs.readFileSync(typeFile, "utf-8");

      // Should generate a union type
      expect(content).toContain("export type StringOrNumber");
      expect(content).toContain("String | Number");
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

      const typeFile = path.join(dir, "MixedType.ts");
      const content = fs.readFileSync(typeFile, "utf-8");

      expect(content).toContain("String | Number | Boolean | Date");
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

      const typeFile = path.join(dir, "FlexibleType.ts");
      expect(fs.existsSync(typeFile)).toBe(true);

      const content = fs.readFileSync(typeFile, "utf-8");
      expect(content).toContain("export type FlexibleType");
    });
  });
});
