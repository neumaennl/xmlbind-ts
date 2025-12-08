import { generateFromXsd } from "../src/xsd/TsGenerator";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { withTmpDir } from "./test-utils/temp-dir";

describe("XSD Generator - List Types", () => {
  test("generates array type for list with itemType", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:simpleType name="StringList">
    <xs:list itemType="xs:string"/>
  </xs:simpleType>
  
  <xs:element name="Tags" type="StringList"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      // Types are now in consolidated types.ts file
      const typeFile = path.join(dir, "types.ts");
      expect(existsSync(typeFile)).toBe(true);

      const content = readFileSync(typeFile, "utf-8");

      // Should generate an array type
      expect(content).toContain("export type StringList");
      expect(content).toContain("string[]");
    });
  });

  test("handles list with integer itemType", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:simpleType name="NumberList">
    <xs:list itemType="xs:integer"/>
  </xs:simpleType>
  
  <xs:element name="Scores" type="NumberList"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      // Types are now in consolidated types.ts file
      const typeFile = path.join(dir, "types.ts");
      const content = readFileSync(typeFile, "utf-8");

      expect(content).toContain("number[]");
    });
  });

  test("handles list with inline simpleType", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:simpleType name="RestrictedList">
    <xs:list>
      <xs:simpleType>
        <xs:restriction base="xs:string">
          <xs:maxLength value="10"/>
        </xs:restriction>
      </xs:simpleType>
    </xs:list>
  </xs:simpleType>
  
  <xs:element name="Codes" type="RestrictedList"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      // Types are now in consolidated types.ts file
      const typeFile = path.join(dir, "types.ts");
      expect(existsSync(typeFile)).toBe(true);

      const content = readFileSync(typeFile, "utf-8");
      expect(content).toContain("RestrictedList");
      expect(content).toContain("string[]");
    });
  });
});
