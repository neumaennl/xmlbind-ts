import { generateFromXsd } from "../src/xsd/TsGenerator";
import { readFileSync, mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";

const SAMPLE_XSD = `<?xml version="1.0" encoding="utf-8"?>\n<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com/ns" elementFormDefault="qualified">\n  <xsd:complexType name="Person">\n    <xsd:sequence>\n      <xsd:element name="name" type="xsd:string"/>\n      <xsd:element name="age" type="xsd:int"/>\n      <xsd:element name="alias" type="xsd:string" maxOccurs="unbounded" minOccurs="0"/>\n    </xsd:sequence>\n    <xsd:attribute name="id" type="xsd:int"/>\n  </xsd:complexType>\n</xsd:schema>`;

describe("XSD Generator", () => {
  test("xsd generator applies correct decorators to class members", () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "xmlbind-ts-"));
    try {
      generateFromXsd(SAMPLE_XSD, tmpDir);
      const target = path.join(tmpDir, "Person.ts");
      const gen = readFileSync(target, "utf8");

      // Check for imports
      expect(gen).toContain(
        "import { XmlRoot, XmlElement, XmlAttribute, XmlText }"
      );

      // Check @XmlRoot decorator with namespace
      expect(gen).toContain("@XmlRoot('Person'");
      expect(gen).toContain("namespace: 'http://example.com/ns'");

      // Check @XmlAttribute decorator for id
      expect(gen).toMatch(/@XmlAttribute\('id'\)\s+id\?: Number/);

      // Check @XmlElement decorators for elements
      expect(gen).toMatch(
        /@XmlElement\('name',\s*\{\s*type:\s*String\s*\}\)\s+name\?: String/
      );

      expect(gen).toMatch(
        /@XmlElement\('age',\s*\{\s*type:\s*Number\s*\}\)\s+age\?: Number/
      );

      // Check @XmlElement decorator with array option for alias
      expect(gen).toMatch(
        /@XmlElement\('alias',\s*\{\s*type:\s*String,\s*array:\s*true\s*\}\)\s+alias\?: String\[\]/
      );
    } finally {
      // cleanup generated files
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  });
});
