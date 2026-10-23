import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { generateFromXsd } from "../src/xsd/TsGenerator.js";
import { withTmpDir } from "./test-utils/temp-dir.js";

const XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:simpleType name="Color">
    <xs:restriction base="xs:string"><xs:enumeration value="red"/></xs:restriction>
  </xs:simpleType>
  <xs:simpleType name="Code">
    <xs:restriction base="xs:string"><xs:pattern value="[A-Z]+"/></xs:restriction>
  </xs:simpleType>
  <xs:complexType name="Item">
    <xs:sequence><xs:element name="name" type="xs:string"/></xs:sequence>
  </xs:complexType>
  <xs:complexType name="Box">
    <xs:sequence>
      <xs:element name="item" type="Item"/>
      <xs:element name="color" type="Color"/>
      <xs:element name="code" type="Code"/>
    </xs:sequence>
  </xs:complexType>
</xs:schema>`;

const RELATIVE_SPECIFIER = /from '(\.[^']*)'/g;

/** Collects all relative module specifiers used in the generated files. */
function relativeSpecifiers(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .flatMap((f) =>
      [...readFileSync(join(dir, f), "utf8").matchAll(RELATIVE_SPECIFIER)].map(
        (m) => m[1]
      )
    );
}

describe("XSD Generator: import extensions", () => {
  test("writes .js in all relative imports and exports by default", () => {
    withTmpDir((tmp) => {
      generateFromXsd(XSD, tmp);
      const specs = relativeSpecifiers(tmp);
      expect(specs.length).toBeGreaterThan(0);
      expect(specs.every((s) => s.endsWith(".js"))).toBe(true);
      expect(readFileSync(join(tmp, "index.ts"), "utf8")).toContain(
        "export { Item } from './Item.js';"
      );
    });
  });

  test("omits extensions when importExtensions is false", () => {
    withTmpDir((tmp) => {
      generateFromXsd(XSD, tmp, false);
      const specs = relativeSpecifiers(tmp);
      expect(specs.length).toBeGreaterThan(0);
      expect(specs.some((s) => s.endsWith(".js"))).toBe(false);
      const box = readFileSync(join(tmp, "Box.ts"), "utf8");
      expect(box).toContain("import { Item } from './Item';");
      expect(box).toContain("import { Color } from './enums';");
      expect(readFileSync(join(tmp, "index.ts"), "utf8")).toContain(
        "export type { Code } from './types';"
      );
    });
  });
});
