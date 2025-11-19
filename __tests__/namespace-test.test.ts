import { generateFromXsd } from "../src/xsd/TsGenerator";
import { readFileSync } from "fs";

import path from "path";
import { withTmpDir } from "./test-utils/temp-dir";

describe("Namespace handling", () => {

  test("generates namespace on @XmlRoot from targetNamespace", () => {
    const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
            targetNamespace="http://example.com/myns" 
            elementFormDefault="qualified">
  <xsd:complexType name="Book">
    <xsd:sequence>
      <xsd:element name="title" type="xsd:string"/>
    </xsd:sequence>
  </xsd:complexType>
</xsd:schema>`;

    withTmpDir((tmp) => {
      generateFromXsd(XSD, tmp);
      const book = readFileSync(path.join(tmp, "Book.ts"), "utf8");
      expect(book).toContain("namespace: 'http://example.com/myns'");
    });
  });

  test("element with form or namespace attribute", () => {
    const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
            targetNamespace="http://example.com/myns" 
            elementFormDefault="qualified">
  <xsd:complexType name="Book">
    <xsd:sequence>
      <xsd:element name="title" type="xsd:string" form="unqualified"/>
      <xsd:element name="isbn" type="xsd:string"/>
    </xsd:sequence>
  </xsd:complexType>
</xsd:schema>`;

    withTmpDir((tmp) => {
      generateFromXsd(XSD, tmp);
      const book = readFileSync(path.join(tmp, "Book.ts"), "utf8");
      // Currently generator doesn't handle per-element namespace/form
      // This test documents current behavior
      expect(book).toContain("@XmlElement('title'");
      expect(book).toContain("@XmlElement('isbn'");
    });
  });

  test("attribute with namespace", () => {
    const XSD = `<?xml version="1.0"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" 
            targetNamespace="http://example.com/myns" 
            elementFormDefault="qualified"
            attributeFormDefault="qualified">
  <xsd:complexType name="Book">
    <xsd:attribute name="id" type="xsd:string"/>
  </xsd:complexType>
</xsd:schema>`;

    withTmpDir((tmp) => {
      generateFromXsd(XSD, tmp);
      const book = readFileSync(path.join(tmp, "Book.ts"), "utf8");
      // Now generator qualifies attribute namespace when attributeFormDefault is qualified
      expect(book).toContain(
        "@XmlAttribute('id', { namespace: 'http://example.com/myns' })"
      );
    });
  });
});
