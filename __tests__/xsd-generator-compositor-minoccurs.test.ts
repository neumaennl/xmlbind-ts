import { readFileSync } from "fs";
import path from "path";
import { withTmpDir } from "./test-utils/temp-dir";
import { setupGeneratedRuntime } from "./test-utils/generated-runtime";

describe("XSD Generator - Compositor minOccurs", () => {
  test("elements in optional compositors are optional", () => {
    withTmpDir((tmpDir) => {
      const xsd = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" targetNamespace="http://test.com" elementFormDefault="qualified">
  <xs:element name="container">
    <xs:complexType>
      <xs:sequence>
        <xs:sequence minOccurs="0">
          <xs:element name="optionalSeqElement" type="xs:string"/>
        </xs:sequence>
        <xs:choice minOccurs="0">
          <xs:element name="optionalChoiceElement1" type="xs:string"/>
          <xs:element name="optionalChoiceElement2" type="xs:int"/>
        </xs:choice>
        <xs:element name="requiredElement" type="xs:string"/>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

      setupGeneratedRuntime(tmpDir, [xsd]);

      const containerContent = readFileSync(path.join(tmpDir, "container.ts"), "utf8");
      
      // Element in optional sequence should be optional
      expect(containerContent).toMatch(/optionalSeqElement\?:\s*String;/);
      
      // Elements in optional choice should be optional (already optional due to choice)
      expect(containerContent).toMatch(/optionalChoiceElement1\?:\s*String;/);
      expect(containerContent).toMatch(/optionalChoiceElement2\?:\s*Number;/);
      
      // Required element should be required
      expect(containerContent).toMatch(/requiredElement!:\s*String;/);
    });
  });

  test("elements with minOccurs=0 in required compositors are optional", () => {
    withTmpDir((tmpDir) => {
      const xsd = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" targetNamespace="http://test.com" elementFormDefault="qualified">
  <xs:element name="container">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="optional" type="xs:string" minOccurs="0"/>
        <xs:element name="required" type="xs:string"/>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

      setupGeneratedRuntime(tmpDir, [xsd]);

      const containerContent = readFileSync(path.join(tmpDir, "container.ts"), "utf8");
      
      // Element with minOccurs="0" should be optional
      expect(containerContent).toMatch(/optional\?:\s*String;/);
      
      // Element with default minOccurs="1" should be required
      expect(containerContent).toMatch(/required!:\s*String;/);
    });
  });

  test("nested optional compositors propagate optionality", () => {
    withTmpDir((tmpDir) => {
      const xsd = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" targetNamespace="http://test.com" elementFormDefault="qualified">
  <xs:element name="container">
    <xs:complexType>
      <xs:sequence>
        <xs:sequence minOccurs="0">
          <xs:sequence>
            <xs:element name="deeplyNested" type="xs:string"/>
          </xs:sequence>
        </xs:sequence>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

      setupGeneratedRuntime(tmpDir, [xsd]);

      const containerContent = readFileSync(path.join(tmpDir, "container.ts"), "utf8");
      
      // Element in nested optional sequence should be optional
      expect(containerContent).toMatch(/deeplyNested\?:\s*String;/);
    });
  });

  test("elements with minOccurs > 1 are arrays", () => {
    withTmpDir((tmpDir) => {
      const xsd = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" targetNamespace="http://test.com" elementFormDefault="qualified">
  <xs:element name="container">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="multipleRequired" type="xs:string" minOccurs="2"/>
        <xs:element name="multipleOptional" type="xs:string" minOccurs="2" maxOccurs="unbounded"/>
        <xs:element name="singleOptional" type="xs:string" minOccurs="0"/>
        <xs:element name="singleRequired" type="xs:string"/>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

      setupGeneratedRuntime(tmpDir, [xsd]);

      const containerContent = readFileSync(path.join(tmpDir, "container.ts"), "utf8");
      
      // Element with minOccurs="2" should be array and required
      expect(containerContent).toMatch(/multipleRequired!:\s*String\[\]/);
      
      // Element with minOccurs="2" maxOccurs="unbounded" should be array and required
      expect(containerContent).toMatch(/multipleOptional!:\s*String\[\]/);
      
      // Element with minOccurs="0" should not be array and optional
      expect(containerContent).toMatch(/singleOptional\?:\s*String;/);
      
      // Element with default minOccurs="1" should not be array and required
      expect(containerContent).toMatch(/singleRequired!:\s*String;/);
    });
  });
});
