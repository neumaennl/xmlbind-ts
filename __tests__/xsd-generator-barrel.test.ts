import { generateFromXsd } from "../src/xsd/TsGenerator";
import { readFileSync, existsSync } from "fs";

import path from "path";
import { withTmpDir } from "./test-utils/temp-dir";

describe("XSD Generator - Barrel Export", () => {

  test("generates barrel export (index.ts) for all generated types", () => {
    const XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"
            targetNamespace="http://example.com/test"
            elementFormDefault="qualified">
  
  <xsd:simpleType name="StatusEnum">
    <xsd:restriction base="xsd:string">
      <xsd:enumeration value="active"/>
      <xsd:enumeration value="inactive"/>
    </xsd:restriction>
  </xsd:simpleType>
  
  <xsd:simpleType name="CodeList">
    <xsd:list itemType="xsd:string"/>
  </xsd:simpleType>
  
  <xsd:complexType name="Address">
    <xsd:sequence>
      <xsd:element name="street" type="xsd:string"/>
      <xsd:element name="city" type="xsd:string"/>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:complexType name="Person">
    <xsd:sequence>
      <xsd:element name="name" type="xsd:string"/>
      <xsd:element name="address" type="Address"/>
      <xsd:element name="status" type="StatusEnum"/>
    </xsd:sequence>
    <xsd:attribute name="id" type="xsd:int"/>
  </xsd:complexType>
  
  <xsd:element name="Person" type="Person"/>
  <xsd:element name="Address" type="Address"/>
</xsd:schema>`;

    withTmpDir((tmpDir) => {
      generateFromXsd(XSD, tmpDir);

      // Verify index.ts exists
      const indexPath = path.join(tmpDir, "index.ts");
      expect(existsSync(indexPath)).toBe(true);

      const indexContent = readFileSync(indexPath, "utf-8");

      // Verify exports for classes
      expect(indexContent).toContain("export { Person } from './Person';");
      expect(indexContent).toContain("export { Address } from './Address';");
      expect(indexContent).toContain(
        "export { PersonElement } from './PersonElement';"
      );
      expect(indexContent).toContain(
        "export { AddressElement } from './AddressElement';"
      );

      // Verify exports for enums/types from consolidated files
      expect(indexContent).toContain("export { StatusEnum } from './enums';");
      expect(indexContent).toContain(
        "export type { CodeList } from './types';"
      );

      // Verify consolidated files exist
      expect(existsSync(path.join(tmpDir, "types.ts"))).toBe(true);
      expect(existsSync(path.join(tmpDir, "enums.ts"))).toBe(true);

      // Verify alphabetical sorting
      const lines = indexContent.trim().split("\n");
      const exportLines = lines.filter((line) => line.startsWith("export"));
      const sortedLines = [...exportLines].sort();
      expect(exportLines).toEqual(sortedLines);
    });
  });

  test("barrel export handles case-insensitive filename collisions", () => {
    const XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:simpleType name="NOTATION">
    <xsd:restriction base="xsd:token"/>
  </xsd:simpleType>
  
  <xsd:complexType name="notation">
    <xsd:attribute name="name" type="xsd:string"/>
  </xsd:complexType>
  
  <xsd:element name="notation" type="notation"/>
</xsd:schema>`;

    withTmpDir((tmpDir) => {
      generateFromXsd(XSD, tmpDir);

      const indexPath = path.join(tmpDir, "index.ts");
      const indexContent = readFileSync(indexPath, "utf-8");

      // Verify both types are exported - type from consolidated file, class from individual file
      expect(indexContent).toContain("export { notation } from './notation';");
      expect(indexContent).toContain(
        "export type { NOTATION } from './types';"
      );
      expect(indexContent).toContain(
        "export { notationElement } from './notationElement';"
      );

      // Verify the NOTATION type is in types.ts, not a separate file
      const typesPath = path.join(tmpDir, "types.ts");
      expect(existsSync(typesPath)).toBe(true);
      const typesContent = readFileSync(typesPath, "utf-8");
      expect(typesContent).toContain("export type NOTATION");
    });
  });

  test("barrel export includes only type exports for type aliases", () => {
    const XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:simpleType name="MyString">
    <xsd:restriction base="xsd:string">
      <xsd:maxLength value="100"/>
    </xsd:restriction>
  </xsd:simpleType>
  
  <xsd:simpleType name="MyUnion">
    <xsd:union memberTypes="xsd:string xsd:int"/>
  </xsd:simpleType>
  
  <xsd:simpleType name="MyList">
    <xsd:list itemType="xsd:string"/>
  </xsd:simpleType>
  
  <xsd:complexType name="MyClass">
    <xsd:attribute name="value" type="MyString"/>
  </xsd:complexType>
  
  <xsd:element name="MyClass" type="MyClass"/>
</xsd:schema>`;

    withTmpDir((tmpDir) => {
      generateFromXsd(XSD, tmpDir);

      const indexPath = path.join(tmpDir, "index.ts");
      const indexContent = readFileSync(indexPath, "utf-8");

      // Type aliases should use 'export type' from consolidated types.ts
      expect(indexContent).toContain(
        "export type { MyString } from './types';"
      );
      expect(indexContent).toContain("export type { MyUnion } from './types';");
      expect(indexContent).toContain("export type { MyList } from './types';");

      // Verify types.ts contains all type aliases
      const typesPath = path.join(tmpDir, "types.ts");
      expect(existsSync(typesPath)).toBe(true);
      const typesContent = readFileSync(typesPath, "utf-8");
      expect(typesContent).toContain("export type MyString");
      expect(typesContent).toContain("export type MyUnion");
      expect(typesContent).toContain("export type MyList");

      // Classes should use regular 'export'
      expect(indexContent).toContain("export { MyClass } from './MyClass';");
      expect(indexContent).toContain(
        "export { MyClassElement } from './MyClassElement';"
      );
    });
  });

  test("barrel export works with empty schema", () => {
    const XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
</xsd:schema>`;

    withTmpDir((tmpDir) => {
      generateFromXsd(XSD, tmpDir);

      const indexPath = path.join(tmpDir, "index.ts");
      expect(existsSync(indexPath)).toBe(true);

      const indexContent = readFileSync(indexPath, "utf-8");
      // Should be empty or just a comment
      const nonEmptyLines = indexContent
        .split("\n")
        .filter((line) => line.trim() && !line.trim().startsWith("//"));
      expect(nonEmptyLines.length).toBe(0);
    });
  });
});
