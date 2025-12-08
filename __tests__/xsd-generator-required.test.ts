import { generateFromXsd } from "../src/xsd/TsGenerator";
import { readFileSync, mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";

const SAMPLE_XSD = `<?xml version="1.0" encoding="utf-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com/ns" elementFormDefault="qualified">
  <xsd:complexType name="Sample">
    <xsd:sequence>
      <xsd:element name="name" type="xsd:string"/>
      <xsd:element name="alias" type="xsd:string" minOccurs="0"/>
      <xsd:element name="tags" type="xsd:string" minOccurs="1" maxOccurs="unbounded"/>
    </xsd:sequence>
    <xsd:attribute name="id" type="xsd:int" use="required"/>
    <xsd:attribute name="note" type="xsd:string"/>
  </xsd:complexType>
</xsd:schema>`;

describe("XSD Generator requiredness", () => {
  test("emits non-optional properties for required members", () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "xmlbind-ts-"));
    try {
      generateFromXsd(SAMPLE_XSD, tmpDir);
      const target = path.join(tmpDir, "Sample.ts");
      const gen = readFileSync(target, "utf8");

      // Required attribute becomes non-optional
      expect(gen).toMatch(/@XmlAttribute\('id'\)[\s\S]*?\bid!?: number;/);

      // Optional attribute stays optional
      expect(gen).toMatch(/@XmlAttribute\('note'\)[\s\S]*?\bnote\?: string;/);

      // Required element (default minOccurs=1) becomes non-optional
      expect(gen).toMatch(
        /@XmlElement\('name',[^)]*\)[\s\S]*?\bname!?: string;/
      );

      // Optional element (minOccurs=0) stays optional
      expect(gen).toMatch(
        /@XmlElement\('alias',[^)]*\)[\s\S]*?\balias\?: string;/
      );

      // Required array element becomes non-optional but remains an array
      expect(gen).toMatch(
        /@XmlElement\('tags',[^)]*array:\s*true[\s\S]*\)[\s\S]*?\btags!?: string\[\];/
      );

      // (No choice in this sample)
    } finally {
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  });
});
