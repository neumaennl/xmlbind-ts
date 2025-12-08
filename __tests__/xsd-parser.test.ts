import { parseXsd, getSchemaRoot, getXsdPrefix } from "../src/xsd/XsdParser";

describe("XsdParser", () => {
  describe("parseXsd", () => {
    it("should parse valid XSD content", () => {
      const xsd = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:element name="root" type="xsd:string"/>
</xsd:schema>`;

      const doc = parseXsd(xsd);
      expect(doc).toBeDefined();
      expect(doc.documentElement).toBeDefined();
    });

    it("should parse XSD without XML declaration", () => {
      const xsd = `<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="root" type="xs:string"/>
</xs:schema>`;

      const doc = parseXsd(xsd);
      expect(doc).toBeDefined();
      expect(doc.documentElement).toBeDefined();
    });

    it("should parse XSD with default namespace", () => {
      const xsd = `<schema xmlns="http://www.w3.org/2001/XMLSchema">
  <element name="root" type="string"/>
</schema>`;

      const doc = parseXsd(xsd);
      expect(doc).toBeDefined();
    });
  });

  describe("getSchemaRoot", () => {
    it("should find schema element with xsd prefix", () => {
      const xsd = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:element name="root" type="xsd:string"/>
</xsd:schema>`;

      const doc = parseXsd(xsd);
      const schema = getSchemaRoot(doc);

      expect(schema).toBeDefined();
      expect(schema?.nodeName).toMatch(/schema/);
    });

    it("should find schema element with xs prefix", () => {
      const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="root" type="xs:string"/>
</xs:schema>`;

      const doc = parseXsd(xsd);
      const schema = getSchemaRoot(doc);

      expect(schema).toBeDefined();
      expect(schema?.nodeName).toMatch(/schema/);
    });

    it("should find schema element with default namespace", () => {
      const xsd = `<?xml version="1.0"?>
<schema xmlns="http://www.w3.org/2001/XMLSchema">
  <element name="root" type="string"/>
</schema>`;

      const doc = parseXsd(xsd);
      const schema = getSchemaRoot(doc);

      expect(schema).toBeDefined();
      expect(schema?.nodeName).toBe("schema");
    });

    it("should find schema element using namespace URI", () => {
      const xsd = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com">
  <xsd:element name="root" type="xsd:string"/>
</xsd:schema>`;

      const doc = parseXsd(xsd);
      const schema = getSchemaRoot(doc);

      expect(schema).toBeDefined();
    });

    it("should return undefined for invalid document", () => {
      const xsd = `<?xml version="1.0"?>
<root>Not a schema</root>`;

      const doc = parseXsd(xsd);
      const schema = getSchemaRoot(doc);

      expect(schema).toBeUndefined();
    });
  });

  describe("getXsdPrefix", () => {
    it("should return prefix from schema element with xsd prefix", () => {
      const xsd = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:element name="root" type="xsd:string"/>
</xsd:schema>`;

      const doc = parseXsd(xsd);
      const schema = getSchemaRoot(doc);
      const prefix = getXsdPrefix(schema!);

      expect(prefix).toBe("xsd");
    });

    it("should return prefix from schema element with xs prefix", () => {
      const xsd = `<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="root" type="xs:string"/>
</xs:schema>`;

      const doc = parseXsd(xsd);
      const schema = getSchemaRoot(doc);
      const prefix = getXsdPrefix(schema!);

      expect(prefix).toBe("xs");
    });

    it("should return empty string for default namespace", () => {
      const xsd = `<?xml version="1.0"?>
<schema xmlns="http://www.w3.org/2001/XMLSchema">
  <element name="root" type="string"/>
</schema>`;

      const doc = parseXsd(xsd);
      const schema = getSchemaRoot(doc);
      const prefix = getXsdPrefix(schema!);

      expect(prefix).toBe("");
    });

    it("should return xsd as fallback when no namespace found", () => {
      const xsd = `<?xml version="1.0"?>
<schema>
  <element name="root" type="string"/>
</schema>`;

      const doc = parseXsd(xsd);
      const schema = getSchemaRoot(doc);
      const prefix = getXsdPrefix(schema!);

      expect(prefix).toBe("xsd");
    });

    it("should detect prefix from xmlns declaration", () => {
      const xsd = `<?xml version="1.0"?>
<myprefix:schema xmlns:myprefix="http://www.w3.org/2001/XMLSchema">
  <myprefix:element name="root" type="myprefix:string"/>
</myprefix:schema>`;

      const doc = parseXsd(xsd);
      const schema = getSchemaRoot(doc);
      const prefix = getXsdPrefix(schema!);

      expect(prefix).toBe("myprefix");
    });

    it("should handle schema without attributes", () => {
      const xsd = `<?xml version="1.0"?>
<schema>
  <element name="root"/>
</schema>`;

      const doc = parseXsd(xsd);
      const schema = getSchemaRoot(doc);

      if (schema) {
        const prefix = getXsdPrefix(schema);
        // eslint-disable-next-line jest/no-conditional-expect
        expect(prefix).toBe("xsd");
      }
    });

    it("should handle schema with multiple namespace declarations", () => {
      const xsd = `<?xml version="1.0"?>
<xsd:schema 
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:tns="http://example.com/target"
  targetNamespace="http://example.com/target">
  <xsd:element name="root" type="xsd:string"/>
</xsd:schema>`;

      const doc = parseXsd(xsd);
      const schema = getSchemaRoot(doc);
      const prefix = getXsdPrefix(schema!);

      expect(prefix).toBe("xsd");
    });
  });

  describe("Integration tests", () => {
    it("should handle complete XSD parsing workflow", () => {
      const xsd = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" 
           targetNamespace="http://example.com/test"
           xmlns:tns="http://example.com/test"
           elementFormDefault="qualified">
  
  <xs:element name="person" type="tns:PersonType"/>
  
  <xs:complexType name="PersonType">
    <xs:sequence>
      <xs:element name="name" type="xs:string"/>
      <xs:element name="age" type="xs:int"/>
    </xs:sequence>
  </xs:complexType>
</xs:schema>`;

      const doc = parseXsd(xsd);
      expect(doc).toBeDefined();

      const schema = getSchemaRoot(doc);
      expect(schema).toBeDefined();
      expect(schema?.getAttribute("targetNamespace")).toBe(
        "http://example.com/test"
      );

      const prefix = getXsdPrefix(schema!);
      expect(prefix).toBe("xs");
    });

    it("should handle XSD with no prefix", () => {
      const xsd = `<?xml version="1.0"?>
<schema xmlns="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com">
  <complexType name="MyType">
    <sequence>
      <element name="field" type="string"/>
    </sequence>
  </complexType>
</schema>`;

      const doc = parseXsd(xsd);
      const schema = getSchemaRoot(doc);
      expect(schema).toBeDefined();

      const prefix = getXsdPrefix(schema!);
      expect(prefix).toBe("");
    });
  });
});
