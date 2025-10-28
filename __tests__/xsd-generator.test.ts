import { generateFromXsd } from "../src/xsd/TsGenerator";
import { readFileSync, existsSync, mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";

const SAMPLE_XSD = `<?xml version="1.0" encoding="utf-8"?>\n<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com/ns" elementFormDefault="qualified">\n  <xsd:complexType name="Person">\n    <xsd:sequence>\n      <xsd:element name="name" type="xsd:string"/>\n      <xsd:element name="age" type="xsd:int"/>\n      <xsd:element name="alias" type="xsd:string" maxOccurs="unbounded" minOccurs="0"/>\n    </xsd:sequence>\n    <xsd:attribute name="id" type="xsd:int"/>\n  </xsd:complexType>\n</xsd:schema>`;

test("xsd generator produces Person.ts with expected members", () => {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), "xmlbind-ts-"));
  try {
    generateFromXsd(SAMPLE_XSD, tmpDir);
    const target = path.join(tmpDir, "Person.ts");
    expect(existsSync(target)).toBe(true);
    const gen = readFileSync(target, "utf8");
    expect(gen).toContain("export class Person");
    // check for properties and attribute name hints
    expect(gen).toMatch(/name.*: String|name\?: String/);
    expect(gen).toMatch(/age.*: Number|age\?: Number/);
    expect(gen).toMatch(/alias.*: String\[\]|alias\?: String\[\]|alias.*Array/);
    expect(gen).toMatch(/id.*: Number|id\?: Number/);
  } finally {
    // cleanup generated files
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
});
