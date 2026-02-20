import { marshal, unmarshal } from "../src/marshalling";
import { XmlRoot, XmlElement, XmlAttribute } from "../src/decorators";
import { generateFromXsd } from "../src/xsd/TsGenerator";
import { readFileSync } from "fs";
import path from "path";
import { withTmpDir } from "./test-utils/temp-dir";

@XmlRoot("Document", {
  namespace: "http://example.com/doc",
  prefixes: { "http://example.com/doc": "doc", "http://example.com/ext": "ext" },
})
class Document {
  @XmlElement("title", { type: String, namespace: "http://example.com/doc" })
  title?: string;

  @XmlElement("extra", { type: String, namespace: "http://example.com/ext" })
  extra?: string;
}

@XmlRoot("Simple", { namespace: "http://example.com/simple" })
class Simple {
  @XmlAttribute("id")
  id?: string;
}

describe("_namespacePrefixes on unmarshalled root object", () => {
  test("unmarshal populates _namespacePrefixes from XML namespace declarations", () => {
    const xml = `<Document xmlns="http://example.com/doc" xmlns:ext="http://example.com/ext">
  <title>Hello</title>
  <ext:extra>World</ext:extra>
</Document>`;

    const doc = unmarshal(Document, xml) as any;
    expect(doc._namespacePrefixes).toBeDefined();
    // Default namespace (empty prefix) is NOT included — it's captured by meta.namespace
    expect(doc._namespacePrefixes[""]).toBeUndefined();
    expect(doc._namespacePrefixes["ext"]).toBe("http://example.com/ext");
  });

  test("unmarshal sets _namespacePrefixes even when no namespace declarations present", () => {
    const xml = `<Simple id="42"/>`;
    const obj = unmarshal(Simple, xml) as any;
    expect(obj._namespacePrefixes).toBeDefined();
    expect(typeof obj._namespacePrefixes).toBe("object");
  });

  test("_namespacePrefixes can be modified and changes are persisted when marshalling", () => {
    const xml = `<Document xmlns="http://example.com/doc" xmlns:ext="http://example.com/ext">
  <ext:extra>World</ext:extra>
</Document>`;

    const doc = unmarshal(Document, xml) as any;
    // Rename the prefix for the ext namespace
    doc._namespacePrefixes["ext2"] = doc._namespacePrefixes["ext"];
    delete doc._namespacePrefixes["ext"];

    const result = marshal(doc);
    expect(result).toContain('xmlns:ext2="http://example.com/ext"');
    expect(result).not.toContain('xmlns:ext=');
  });

  test("marshal uses _namespacePrefixes over meta.prefixes when set", () => {
    const xml = `<Document xmlns="http://example.com/doc" xmlns:e="http://example.com/ext">
  <e:extra>World</e:extra>
</Document>`;

    // XML uses "e" as prefix, decorator defines "ext"
    const doc = unmarshal(Document, xml) as any;
    expect(doc._namespacePrefixes["e"]).toBe("http://example.com/ext");
    expect(doc._namespacePrefixes["ext"]).toBeUndefined();

    const result = marshal(doc);
    // Should use "e" from _namespacePrefixes, not "ext" from decorator
    expect(result).toContain('xmlns:e="http://example.com/ext"');
    expect(result).not.toContain('xmlns:ext=');
  });

  test("marshal falls back to meta.prefixes when _namespacePrefixes is not set", () => {
    const doc = new Document();
    doc.extra = "World";

    const result = marshal(doc);
    // New object has no _namespacePrefixes, should use decorator-defined "ext"
    expect(result).toContain('xmlns:ext="http://example.com/ext"');
  });

  test("roundtrip preserves namespace prefix assignments", () => {
    const xml = `<Document xmlns="http://example.com/doc" xmlns:ext="http://example.com/ext">
  <title>My Title</title>
  <ext:extra>Details</ext:extra>
</Document>`;

    const doc = unmarshal(Document, xml) as any;
    expect(doc.title).toBe("My Title");
    expect(doc.extra).toBe("Details");

    const result = marshal(doc);

    const back = unmarshal(Document, result) as any;
    expect(back.title).toBe("My Title");
    expect(back.extra).toBe("Details");
    expect(back._namespacePrefixes).toBeDefined();
  });
});

describe("_namespacePrefixes in generated XSD classes", () => {
  test("generated root class declares _namespacePrefixes property", () => {
    const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"
            targetNamespace="http://example.com/ns"
            elementFormDefault="qualified">
  <xsd:element name="Root" type="xsd:string"/>
</xsd:schema>`;

    withTmpDir((tmp) => {
      generateFromXsd(XSD, tmp);
      const content = readFileSync(path.join(tmp, "Root.ts"), "utf8");
      expect(content).toContain("_namespacePrefixes?: Record<string, string>");
    });
  });

  test("generated root wrapper class (extending complex type) declares _namespacePrefixes", () => {
    const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"
            targetNamespace="http://example.com/ns"
            elementFormDefault="qualified">
  <xsd:complexType name="PersonType">
    <xsd:sequence>
      <xsd:element name="name" type="xsd:string"/>
    </xsd:sequence>
  </xsd:complexType>
  <xsd:element name="Person" type="PersonType"/>
</xsd:schema>`;

    withTmpDir((tmp) => {
      generateFromXsd(XSD, tmp);
      // Person (root element wrapper extending PersonType) should have _namespacePrefixes
      const personContent = readFileSync(path.join(tmp, "Person.ts"), "utf8");
      expect(personContent).toContain("_namespacePrefixes?: Record<string, string>");
      // PersonType (base complex type) should NOT have _namespacePrefixes
      const personTypeContent = readFileSync(
        path.join(tmp, "PersonType.ts"),
        "utf8"
      );
      expect(personTypeContent).not.toContain("_namespacePrefixes");
    });
  });

  test("generated inline complexType root class declares _namespacePrefixes", () => {
    const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"
            targetNamespace="http://example.com/ns"
            elementFormDefault="qualified">
  <xsd:element name="Config">
    <xsd:complexType>
      <xsd:sequence>
        <xsd:element name="value" type="xsd:string"/>
      </xsd:sequence>
    </xsd:complexType>
  </xsd:element>
</xsd:schema>`;

    withTmpDir((tmp) => {
      generateFromXsd(XSD, tmp);
      const content = readFileSync(path.join(tmp, "Config.ts"), "utf8");
      expect(content).toContain("_namespacePrefixes?: Record<string, string>");
    });
  });
});
