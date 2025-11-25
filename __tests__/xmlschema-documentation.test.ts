import { readFileSync } from "fs";
import path from "path";
import { withTmpDir } from "./test-utils/temp-dir";
import {
  setupGeneratedRuntime,
  loadGeneratedClasses,
} from "./test-utils/generated-runtime";
import { unmarshal } from "../src/marshalling/unmarshal";

describe("XMLSchema Documentation Unmarshalling", () => {
  test("documentation text should be unmarshalled correctly", () => {
    withTmpDir((tmpDir) => {
      // Load XMLSchema.xsd
      const xsdPath = path.join(__dirname, "test-resources", "XMLSchema.xsd");
      const xmlSchemaXsd = readFileSync(xsdPath, "utf-8");

      // Generate TypeScript classes
      console.log("Generating TypeScript classes from XMLSchema.xsd...");
      setupGeneratedRuntime(tmpDir, [xmlSchemaXsd]);

      // Get the schema class
      const { schema: Schema } = loadGeneratedClasses(tmpDir, ["schema"]);

      // Load the example.xsd file
      const exampleXsdPath = path.join(
        __dirname,
        "test-resources",
        "example.xsd"
      );
      const exampleXsd = readFileSync(exampleXsdPath, "utf-8");

      // Unmarshal the example.xsd
      const result = unmarshal(Schema, exampleXsd) as any;

      // Verify the schema was unmarshalled
      expect(result).toBeDefined();
      expect(result.element).toBeDefined();

      // Verify the example element has an annotation with documentation
      expect(result.element.annotation).toBeDefined();
      expect(result.element.annotation.documentation).toBeDefined();

      // Verify the documentation text was correctly unmarshalled
      // The documentation element should have a 'value' property containing the text
      expect(result.element.annotation.documentation).toHaveProperty("value");
      expect(result.element.annotation.documentation.value).toBe(
        "root element"
      );

      // Also check the complexType annotations
      expect(result.complexType).toBeDefined();
      expect(Array.isArray(result.complexType)).toBe(true);

      const choiceType = result.complexType.find(
        (ct: any) => ct.name === "choiceType"
      );
      expect(choiceType).toBeDefined();
      expect(choiceType.annotation).toBeDefined();
      expect(choiceType.annotation.documentation).toBeDefined();
      expect(choiceType.annotation.documentation.value).toBe(
        "complexType showing a choice"
      );

      const loggingType = result.complexType.find(
        (ct: any) => ct.name === "loggingType"
      );
      expect(loggingType).toBeDefined();
      expect(loggingType.annotation).toBeDefined();
      expect(loggingType.annotation.documentation).toBeDefined();
      expect(loggingType.annotation.documentation.value).toBe(
        "complexType secribing a log entry"
      );

      // Check simpleType annotation
      expect(result.simpleType).toBeDefined();
      expect(result.simpleType.annotation).toBeDefined();
      expect(result.simpleType.annotation.documentation).toBeDefined();
      expect(result.simpleType.annotation.documentation.value).toBe(
        "a simple string with a max length"
      );
    });
  }, 30000);

  test("documentation with attributes should be unmarshalled correctly", () => {
    withTmpDir((tmpDir) => {
      // Load XMLSchema.xsd
      const xsdPath = path.join(__dirname, "test-resources", "XMLSchema.xsd");
      const xmlSchemaXsd = readFileSync(xsdPath, "utf-8");

      // Generate TypeScript classes
      setupGeneratedRuntime(tmpDir, [xmlSchemaXsd]);

      // Get the schema class
      const { schema: Schema } = loadGeneratedClasses(tmpDir, ["schema"]);

      // Test with documentation that has a source attribute
      const schemaWithAttributedDoc = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="test">
    <xs:annotation>
      <xs:documentation source="http://example.com">documentation with source attribute</xs:documentation>
    </xs:annotation>
  </xs:element>
</xs:schema>`;

      const result = unmarshal(Schema, schemaWithAttributedDoc) as any;

      // Verify the documentation text and attribute were both unmarshalled
      expect(result.element.annotation.documentation).toBeDefined();
      expect(result.element.annotation.documentation.value).toBe(
        "documentation with source attribute"
      );
      expect(result.element.annotation.documentation.source).toBe(
        "http://example.com"
      );
    });
  }, 30000);
});
