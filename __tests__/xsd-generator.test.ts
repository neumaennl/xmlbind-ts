import { generateFromXsd } from "../src/xsd/TsGenerator";
import { readFileSync, existsSync } from "fs";

const SAMPLE_XSD = `<?xml version="1.0" encoding="utf-8"?>\n<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com/ns" elementFormDefault="qualified">\n  <xsd:complexType name="Person">\n    <xsd:sequence>\n      <xsd:element name="name" type="xsd:string"/>\n      <xsd:element name="age" type="xsd:int"/>\n      <xsd:element name="aliases" type="xsd:string" maxOccurs="unbounded" minOccurs="0"/>\n    </xsd:sequence>\n    <xsd:attribute name="id" type="xsd:int"/>\n  </xsd:complexType>\n</xsd:schema>`;

test("xsd generator produces Person.ts", () => {
  generateFromXsd(SAMPLE_XSD, "./generated");
  expect(existsSync("./generated/Person.ts")).toBe(true);
  const gen = readFileSync("./generated/Person.ts", "utf8");
  expect(gen).toContain("export class Person");
});
