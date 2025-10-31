import { generateFromXsd } from "../src/xsd/TsGenerator";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

function withTmpDir(fn: (dir: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xmlbind-any-"));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("XSD Generator - Wildcards", () => {
  test("emits XmlAnyElement for xs:any", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="Container">
    <xs:sequence>
      <xs:any minOccurs="0" maxOccurs="unbounded"/>
    </xs:sequence>
  </xs:complexType>
  <xs:element name="Root" type="Container"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);
      const file = path.join(dir, "Container.ts");
      const content = fs.readFileSync(file, "utf-8");
      expect(content).toContain("@XmlAnyElement(");
      expect(content).toContain("_any?: unknown[]");
    });
  });

  test("emits XmlAnyAttribute for xs:anyAttribute", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="WithAttrs">
    <xs:sequence/>
    <xs:anyAttribute/>
  </xs:complexType>
  <xs:element name="A" type="WithAttrs"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);
      const file = path.join(dir, "WithAttrs.ts");
      const content = fs.readFileSync(file, "utf-8");
      expect(content).toContain("@XmlAnyAttribute(");
      expect(content).toContain("_anyAttributes?: { [name: string]: string }");
    });
  });
});
