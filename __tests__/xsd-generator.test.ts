import { generateFromXsd } from "../src/xsd/TsGenerator";
import { readFileSync } from "fs";
import path from "path";
import { withTmpDir } from "./test-utils/temp-dir";

const SAMPLE_XSD = `<?xml version="1.0" encoding="utf-8"?>\n<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com/ns" elementFormDefault="qualified">\n  <xsd:complexType name="Person">\n    <xsd:sequence>\n      <xsd:element name="name" type="xsd:string"/>\n      <xsd:element name="age" type="xsd:int"/>\n      <xsd:element name="alias" type="xsd:string" maxOccurs="unbounded" minOccurs="0"/>\n    </xsd:sequence>\n    <xsd:attribute name="id" type="xsd:int"/>\n  </xsd:complexType>\n</xsd:schema>`;

describe("XSD Generator", () => {

  test("xsd generator applies correct decorators to class members", () => {
    withTmpDir((tmpDir) => {
      generateFromXsd(SAMPLE_XSD, tmpDir);
      const target = path.join(tmpDir, "Person.ts");
      const gen = readFileSync(target, "utf8");

      // Check for imports - now dynamically imports only what's used
      expect(gen).toContain("import { XmlRoot, XmlElement, XmlAttribute }");
      expect(gen).toContain("from '@neumaennl/xmlbind-ts'");

      // Check @XmlRoot decorator with namespace
      expect(gen).toContain("@XmlRoot('Person'");
      expect(gen).toContain("namespace: 'http://example.com/ns'");

      // Check @XmlAttribute decorator for id
      expect(gen).toMatch(/@XmlAttribute\('id'\)\s+id\?: Number/);

      // Check @XmlElement decorators for required elements (now non-optional)
      expect(gen).toMatch(
        /@XmlElement\('name',\s*\{\s*type:\s*String,\s*namespace:\s*'http:\/\/example.com\/ns'\s*\}\)\s+name!?: String/
      );

      expect(gen).toMatch(
        /@XmlElement\('age',\s*\{\s*type:\s*Number,\s*namespace:\s*'http:\/\/example.com\/ns'\s*\}\)\s+age!?: Number/
      );

      // Check @XmlElement decorator with array option for alias
      expect(gen).toMatch(
        /@XmlElement\('alias',\s*\{\s*type:\s*String,\s*array:\s*true,\s*namespace:\s*'http:\/\/example.com\/ns'\s*\}\)\s+alias\?: String\[\]/
      );
    }, "xmlbind-ts-");
  });

  describe("Type resolution", () => {
    describe("resolveType with enum types", () => {
      test("resolves enum type reference in element", () => {
        const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:simpleType name="StatusEnum">
    <xsd:restriction base="xsd:string">
      <xsd:enumeration value="active"/>
      <xsd:enumeration value="inactive"/>
    </xsd:restriction>
  </xsd:simpleType>
  
  <xsd:complexType name="Record">
    <xsd:sequence>
      <xsd:element name="status" type="StatusEnum"/>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="Record" type="Record"/>
</xsd:schema>`;

        withTmpDir((tmp) => {
          generateFromXsd(XSD, tmp);
          const content = readFileSync(path.join(tmp, "Record.ts"), "utf8");

          expect(content).toContain("import { StatusEnum } from './enums'");
          expect(content).toContain("type: StatusEnum");
        });
      });

      test("resolves enum type in attribute", () => {
        const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:simpleType name="SizeEnum">
    <xsd:restriction base="xsd:string">
      <xsd:enumeration value="small"/>
      <xsd:enumeration value="medium"/>
      <xsd:enumeration value="large"/>
    </xsd:restriction>
  </xsd:simpleType>
  
  <xsd:complexType name="Product">
    <xsd:attribute name="size" type="SizeEnum"/>
  </xsd:complexType>
  
  <xsd:element name="Product" type="Product"/>
</xsd:schema>`;

        withTmpDir((tmp) => {
          generateFromXsd(XSD, tmp);
          const content = readFileSync(path.join(tmp, "Product.ts"), "utf8");

          expect(content).toContain("size?: SizeEnum");
        });
      });
    });

    describe("resolveType with simpleType references", () => {
      test("resolves simpleType with restriction base", () => {
        const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:simpleType name="PositiveInt">
    <xsd:restriction base="xsd:integer">
      <xsd:minInclusive value="1"/>
    </xsd:restriction>
  </xsd:simpleType>
  
  <xsd:complexType name="Counter">
    <xsd:sequence>
      <xsd:element name="count" type="PositiveInt"/>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="Counter" type="Counter"/>
</xsd:schema>`;

        withTmpDir((tmp) => {
          generateFromXsd(XSD, tmp);
          const content = readFileSync(path.join(tmp, "Counter.ts"), "utf8");

          expect(content).toContain("count!: PositiveInt");
        });
      });

      test("resolves simpleType with restriction without base", () => {
        const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:simpleType name="PatternString">
    <xsd:restriction>
      <xsd:pattern value="[A-Z]{3}"/>
    </xsd:restriction>
  </xsd:simpleType>
  
  <xsd:complexType name="Code">
    <xsd:sequence>
      <xsd:element name="value" type="PatternString"/>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="Code" type="Code"/>
</xsd:schema>`;

        withTmpDir((tmp) => {
          generateFromXsd(XSD, tmp);
          const content = readFileSync(path.join(tmp, "Code.ts"), "utf8");

          expect(content).toContain("value!: PatternString");
        });
      });

      test("resolves simpleType without restriction (defaults to String)", () => {
        const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:simpleType name="CustomString">
    <xsd:union memberTypes="xsd:string"/>
  </xsd:simpleType>
  
  <xsd:complexType name="Text">
    <xsd:sequence>
      <xsd:element name="content" type="CustomString"/>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="Text" type="Text"/>
</xsd:schema>`;

        withTmpDir((tmp) => {
          generateFromXsd(XSD, tmp);
          const content = readFileSync(path.join(tmp, "Text.ts"), "utf8");

          expect(content).toContain("content!: CustomString");
        });
      });

      test("recursively resolves nested simpleType restrictions", () => {
        const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:simpleType name="BaseString">
    <xsd:restriction base="xsd:string">
      <xsd:maxLength value="100"/>
    </xsd:restriction>
  </xsd:simpleType>
  
  <xsd:simpleType name="ShortString">
    <xsd:restriction base="BaseString">
      <xsd:maxLength value="10"/>
    </xsd:restriction>
  </xsd:simpleType>
  
  <xsd:complexType name="Message">
    <xsd:sequence>
      <xsd:element name="title" type="ShortString"/>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="Message" type="Message"/>
</xsd:schema>`;

        withTmpDir((tmp) => {
          generateFromXsd(XSD, tmp);
          const content = readFileSync(path.join(tmp, "Message.ts"), "utf8");

          expect(content).toContain("title!: ShortString");
        });
      });

      test("handles simpleType restriction with no base attribute", () => {
        const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:simpleType name="NoBaseRestriction">
    <xsd:restriction>
      <xsd:maxLength value="50"/>
    </xsd:restriction>
  </xsd:simpleType>
  
  <xsd:complexType name="Data">
    <xsd:sequence>
      <xsd:element name="field" type="NoBaseRestriction"/>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="Data" type="Data"/>
</xsd:schema>`;

        withTmpDir((tmp) => {
          generateFromXsd(XSD, tmp);
          const content = readFileSync(path.join(tmp, "Data.ts"), "utf8");

          expect(content).toContain("field!: NoBaseRestriction");
        });
      });

      test("resolves builtin types directly", () => {
        const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="BasicTypes">
    <xsd:sequence>
      <xsd:element name="text" type="xsd:string"/>
      <xsd:element name="number" type="xsd:integer"/>
      <xsd:element name="flag" type="xsd:boolean"/>
      <xsd:element name="timestamp" type="xsd:dateTime"/>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="BasicTypes" type="BasicTypes"/>
</xsd:schema>`;

        withTmpDir((tmp) => {
          generateFromXsd(XSD, tmp);
          const content = readFileSync(path.join(tmp, "BasicTypes.ts"), "utf8");

          expect(content).toContain("text!: String");
          expect(content).toContain("number_!: Number");
          expect(content).toContain("flag!: Boolean");
          expect(content).toContain("timestamp!: Date");
        });
      });
    });

    describe("resolveType with generated inline enums", () => {
      test("reuses inline enum generated from element", () => {
        const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="Config">
    <xsd:sequence>
      <xsd:element name="mode">
        <xsd:simpleType>
          <xsd:restriction base="xsd:string">
            <xsd:enumeration value="development"/>
            <xsd:enumeration value="production"/>
          </xsd:restriction>
        </xsd:simpleType>
      </xsd:element>
      <xsd:element name="fallbackMode">
        <xsd:simpleType>
          <xsd:restriction base="xsd:string">
            <xsd:enumeration value="dev"/>
            <xsd:enumeration value="prod"/>
          </xsd:restriction>
        </xsd:simpleType>
      </xsd:element>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="Config" type="Config"/>
</xsd:schema>`;

        withTmpDir((tmp) => {
          generateFromXsd(XSD, tmp);
          const content = readFileSync(path.join(tmp, "Config.ts"), "utf8");

          expect(content).toContain("modeEnum");
          expect(content).toContain("fallbackModeEnum");
        });
      });
    });

    describe("resolveType with null/undefined type", () => {
      test("defaults to String when type is not specified on attribute", () => {
        const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="NoTypeAttr">
    <xsd:attribute name="myAttr"/>
  </xsd:complexType>
  
  <xsd:element name="NoTypeAttr" type="NoTypeAttr"/>
</xsd:schema>`;

        withTmpDir((tmp) => {
          generateFromXsd(XSD, tmp);
          const content = readFileSync(path.join(tmp, "NoTypeAttr.ts"), "utf8");

          // Attribute without type should default to String
          expect(content).toContain("myAttr?: String");
        });
      });

      test("defaults to String when type is not specified on element", () => {
        const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="NoType">
    <xsd:sequence>
      <xsd:element name="field"/>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="NoType" type="NoType"/>
</xsd:schema>`;

        withTmpDir((tmp) => {
          generateFromXsd(XSD, tmp);
          const content = readFileSync(path.join(tmp, "NoType.ts"), "utf8");

          expect(content).toContain("field");
        });
      });
    });

    describe("resolveType with simpleType without restriction", () => {
      test("handles simpleType with union type", () => {
        const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:simpleType name="UnionType">
    <xsd:union memberTypes="xsd:string xsd:int"/>
  </xsd:simpleType>
  
  <xsd:complexType name="UsesUnion">
    <xsd:sequence>
      <xsd:element name="value" type="UnionType"/>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="UsesUnion" type="UsesUnion"/>
</xsd:schema>`;

        withTmpDir((tmp) => {
          generateFromXsd(XSD, tmp);
          const content = readFileSync(path.join(tmp, "UsesUnion.ts"), "utf8");

          // Should use the generated union type
          expect(content).toContain("UnionType");
        });
      });

      test("handles simpleType restriction with recursive base resolution", () => {
        const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:simpleType name="RestrictedString">
    <xsd:restriction base="xsd:string">
      <xsd:maxLength value="100"/>
    </xsd:restriction>
  </xsd:simpleType>
  
  <xsd:complexType name="UsesRestricted">
    <xsd:attribute name="code" type="RestrictedString"/>
  </xsd:complexType>
  
  <xsd:element name="UsesRestricted" type="UsesRestricted"/>
</xsd:schema>`;

        withTmpDir((tmp) => {
          generateFromXsd(XSD, tmp);
          const content = readFileSync(
            path.join(tmp, "UsesRestricted.ts"),
            "utf8"
          );

          // RestrictedString should be generated as a type alias and used in the property
          expect(content).toContain("code?: RestrictedString");
          expect(content).toContain(
            "import type { RestrictedString } from './types'"
          );

          // RestrictedString should be a type alias in types.ts
          const typesContent = readFileSync(path.join(tmp, "types.ts"), "utf8");
          expect(typesContent).toContain(
            "export type RestrictedString = String"
          );
        });
      });
    });
  });
  describe("Namespace handling", () => {
    test("top-level elements always use targetNamespace", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
            targetNamespace="http://example.com/toplevel"
            elementFormDefault="unqualified">
  <xsd:complexType name="TopLevelTest">
    <xsd:sequence>
      <xsd:element name="child" type="xsd:string"/>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="TopLevelTest" type="TopLevelTest"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(path.join(tmp, "TopLevelTest.ts"), "utf8");

        // Top-level element should use targetNamespace even with elementFormDefault=unqualified
        expect(content).toContain("@XmlRoot('TopLevelTest'");
        expect(content).toContain("namespace: 'http://example.com/toplevel'");
      });
    });

    test("handles elementFormDefault=qualified", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
            targetNamespace="http://example.com/ns"
            elementFormDefault="qualified">
  <xsd:complexType name="Item">
    <xsd:sequence>
      <xsd:element name="field" type="xsd:string"/>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="Item" type="Item"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(path.join(tmp, "Item.ts"), "utf8");

        expect(content).toContain("namespace: 'http://example.com/ns'");
      });
    });

    test("handles elementFormDefault=unqualified", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
            targetNamespace="http://example.com/ns"
            elementFormDefault="unqualified">
  <xsd:complexType name="Item">
    <xsd:sequence>
      <xsd:element name="field" type="xsd:string"/>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="Item" type="Item"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(path.join(tmp, "Item.ts"), "utf8");

        // Element should not have namespace in decorator for unqualified
        const fieldMatch = content.match(/@XmlElement\('field'.*?\)/s);
        expect(fieldMatch).toBeTruthy();
        if (fieldMatch) {
          expect(fieldMatch[0]).not.toContain("namespace:");
        }
      });
    });

    test("handles element form=qualified override", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
            targetNamespace="http://example.com/ns"
            elementFormDefault="unqualified">
  <xsd:complexType name="Item">
    <xsd:sequence>
      <xsd:element name="qualified" type="xsd:string" form="qualified"/>
      <xsd:element name="unqualified" type="xsd:string" form="unqualified"/>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="Item" type="Item"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(path.join(tmp, "Item.ts"), "utf8");

        expect(content).toContain("qualified");
        expect(content).toContain("unqualified");
      });
    });

    test("handles attributeFormDefault=qualified", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
            targetNamespace="http://example.com/ns"
            attributeFormDefault="qualified">
  <xsd:complexType name="Item">
    <xsd:attribute name="attr" type="xsd:string"/>
  </xsd:complexType>
  
  <xsd:element name="Item" type="Item"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(path.join(tmp, "Item.ts"), "utf8");

        expect(content).toContain("@XmlAttribute('attr'");
      });
    });

    test("handles attribute form=qualified override", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
            targetNamespace="http://example.com/ns"
            attributeFormDefault="unqualified">
  <xsd:complexType name="Item">
    <xsd:attribute name="qualified" type="xsd:string" form="qualified"/>
    <xsd:attribute name="unqualified" type="xsd:string" form="unqualified"/>
  </xsd:complexType>
  
  <xsd:element name="Item" type="Item"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const content = readFileSync(path.join(tmp, "Item.ts"), "utf8");

        expect(content).toContain("qualified");
        expect(content).toContain("unqualified");
      });
    });
  });

  describe("Inline complexType", () => {
    test("generates anonymous class for inline complexType", () => {
      const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:complexType name="Container">
    <xsd:sequence>
      <xsd:element name="nested">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="innerField" type="xsd:string"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
    </xsd:sequence>
  </xsd:complexType>
  
  <xsd:element name="Container" type="Container"/>
</xsd:schema>`;

      withTmpDir((tmp) => {
        generateFromXsd(XSD, tmp);
        const containerContent = readFileSync(
          path.join(tmp, "Container.ts"),
          "utf8"
        );

        expect(containerContent).toContain("nestedType");

        const nestedContent = readFileSync(
          path.join(tmp, "nestedType.ts"),
          "utf8"
        );
        expect(nestedContent).toContain("export class nestedType");
        expect(nestedContent).toContain("innerField");
      });
    });
  });
});
