import { generateFromXsd } from "../src/xsd/TsGenerator";
import { readFileSync } from "fs";
import path from "path";
import { withTmpDir } from "./test-utils/temp-dir";



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
      const content = readFileSync(file, "utf-8");
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
      const content = readFileSync(file, "utf-8");
      expect(content).toContain("@XmlAnyAttribute(");
      expect(content).toContain("_anyAttributes?: { [name: string]: string }");
    });
  });

  describe("Wildcard edge cases", () => {
    test("does not duplicate @XmlAnyElement", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="MultipleAny">
    <xsd:sequence>
      <xsd:any minOccurs="0" maxOccurs="unbounded"/>
      <xsd:any minOccurs="0" maxOccurs="unbounded"/>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="MultipleAny" type="MultipleAny"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(
          path.join(tmp, "MultipleAny.ts"),
          "utf8"
        );

        const matches = content.match(/@XmlAnyElement\(\)/g);
        expect(matches).toHaveLength(1);
      });
    });
  });

  describe("Group references", () => {
    test("handles direct group as child of complexType", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:group name="DirectGroup">
    <xsd:sequence>
      <xsd:element name="field" type="xsd:string"/>
    </xsd:sequence>
  </xsd:group>
  
  <xsd:complexType name="DirectGroupUsage">
    <xsd:group ref="DirectGroup"/>
  </xsd:complexType>
  
  <xsd:element name="DirectGroupUsage" type="DirectGroupUsage"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(
          path.join(tmp, "DirectGroupUsage.ts"),
          "utf8"
        );

        expect(content).toContain("@XmlElement('field'");
      });
    });
  });
});
