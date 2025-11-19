import { generateFromXsd } from "../src/xsd/TsGenerator";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { withTmpDir } from "./test-utils/temp-dir";



describe("XSD Generator - Reserved Word Handling", () => {
  test("handles reserved words in class names", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:complexType name="import">
    <xs:sequence>
      <xs:element name="data" type="xs:string"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:element name="ImportData" type="import"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      // Should rename 'import' to avoid reserved word
      const importFile = path.join(dir, "import_.ts");
      expect(existsSync(importFile)).toBe(true);

      const content = readFileSync(importFile, "utf-8");

      // Should have sanitized class name
      expect(content).toContain("export class import_");
    });
  });

  test("handles reserved words in element/property names", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:complexType name="Config">
    <xs:sequence>
      <xs:element name="class" type="xs:string"/>
      <xs:element name="public" type="xs:string"/>
      <xs:element name="default" type="xs:string"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:element name="Configuration" type="Config"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      const configFile = path.join(dir, "Config.ts");
      const content = readFileSync(configFile, "utf-8");

      // Property names should be sanitized; required elements are non-optional
      expect(content).toMatch(/\bclass_!?:/);
      expect(content).toMatch(/\bpublic_!?:/);
      expect(content).toMatch(/\bdefault_!?:/);
    });
  });

  test("handles reserved words in type names", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:simpleType name="void">
    <xs:restriction base="xs:string">
      <xs:enumeration value="empty"/>
      <xs:enumeration value="null"/>
    </xs:restriction>
  </xs:simpleType>
  
  <xs:element name="VoidType" type="void"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      // Enums are now in consolidated enums.ts file
      const enumsFile = path.join(dir, "enums.ts");
      expect(existsSync(enumsFile)).toBe(true);

      const enumContent = readFileSync(enumsFile, "utf-8");

      // Should have sanitized enum name inside
      expect(enumContent).toContain("export enum void_");

      // And the referencing class should import from './enums'
      const voidTypeFile = path.join(dir, "VoidType.ts");
      expect(existsSync(voidTypeFile)).toBe(true);
      const classContent = readFileSync(voidTypeFile, "utf-8");
      expect(classContent).toContain("import { void_ } from './enums';");
    });
  });

  test("handles multiple reserved words in the same schema", () => {
    const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  
  <xs:complexType name="export">
    <xs:sequence>
      <xs:element name="const" type="xs:string"/>
    </xs:sequence>
    <xs:attribute name="static" type="xs:string"/>
  </xs:complexType>
  
  <xs:complexType name="interface">
    <xs:sequence>
      <xs:element name="extends" type="xs:string"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:element name="ExportData" type="export"/>
  <xs:element name="InterfaceData" type="interface"/>
</xs:schema>`;

    withTmpDir((dir) => {
      generateFromXsd(xsd, dir);

      const exportFile = path.join(dir, "export_.ts");
      const interfaceFile = path.join(dir, "interface_.ts");

      expect(existsSync(exportFile)).toBe(true);
      expect(existsSync(interfaceFile)).toBe(true);

      const exportContent = readFileSync(exportFile, "utf-8");
      const interfaceContent = readFileSync(interfaceFile, "utf-8");

      expect(exportContent).toContain("export class export_");
      // element is required -> non-optional
      expect(exportContent).toMatch(/\bconst_!?:/);
      // attribute is optional by default -> remains optional
      expect(exportContent).toContain("static_?:");

      expect(interfaceContent).toContain("export class interface_");
      // element required -> non-optional
      expect(interfaceContent).toMatch(/\bextends_!?:/);
    });
  });
});
