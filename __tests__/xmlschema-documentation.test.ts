import { readFileSync } from "fs";
import path from "path";
import { withTmpDir } from "./test-utils/temp-dir.js";
import {
  setupGeneratedRuntime,
  loadGeneratedClasses,
} from "./test-utils/generated-runtime.js";
import { unmarshal } from "../src/marshalling/unmarshal.js";

/**
 * Returns the first value from an array, or the value itself when it is singular.
 * @param value - A value that may be represented as an array
 * @returns The first item or the original value
 */
function firstOrSelf<T>(value: T | T[] | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value;
}

describe("XMLSchema Documentation Unmarshalling", () => {
  test("documentation text should be unmarshalled correctly", async () => {
    await withTmpDir(async (tmpDir) => {
      // Load XMLSchema.xsd
      const xsdPath = path.join(__dirname, "test-resources", "XMLSchema.xsd");
      const xmlSchemaXsd = readFileSync(xsdPath, "utf-8");

      // Generate TypeScript classes
      console.log("Generating TypeScript classes from XMLSchema.xsd...");
      setupGeneratedRuntime(tmpDir, [xmlSchemaXsd]);

      // Get the schema class
      const { schema: Schema } = await loadGeneratedClasses(tmpDir, ["schema"]);

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
      const exampleElement = firstOrSelf(result.element);
      const annotation = firstOrSelf(exampleElement?.annotation);
      const documentation = firstOrSelf(annotation?.documentation);
      expect(annotation).toBeDefined();
      expect(documentation).toBeDefined();

      // Verify the documentation text was correctly unmarshalled
      // The documentation element should have a 'value' property containing the text
      expect(documentation).toHaveProperty("value");
      expect(documentation.value).toBe("root element");

      // Also check the complexType annotations
      expect(result.complexType).toBeDefined();
      expect(Array.isArray(result.complexType)).toBe(true);

      const choiceType = result.complexType.find(
        (ct: any) => ct.name === "choiceType"
      );
      expect(choiceType).toBeDefined();
      const choiceAnnotation = firstOrSelf(choiceType.annotation);
      const choiceDocumentation = firstOrSelf(choiceAnnotation?.documentation);
      expect(choiceAnnotation).toBeDefined();
      expect(choiceDocumentation).toBeDefined();
      expect(choiceDocumentation.value).toBe("complexType showing a choice");

      const loggingType = result.complexType.find(
        (ct: any) => ct.name === "loggingType"
      );
      expect(loggingType).toBeDefined();
      const loggingAnnotation = firstOrSelf(loggingType.annotation);
      const loggingDocumentation = firstOrSelf(loggingAnnotation?.documentation);
      expect(loggingAnnotation).toBeDefined();
      expect(loggingDocumentation).toBeDefined();
      expect(loggingDocumentation.value).toBe("complexType secribing a log entry");

      // Check simpleType annotation
      expect(result.simpleType).toBeDefined();
      const simpleType = firstOrSelf(result.simpleType);
      const simpleAnnotation = firstOrSelf(simpleType?.annotation);
      const simpleDocumentation = firstOrSelf(simpleAnnotation?.documentation);
      expect(simpleAnnotation).toBeDefined();
      expect(simpleDocumentation).toBeDefined();
      expect(simpleDocumentation.value).toBe("a simple string with a max length");
    });
  }, 30000);

  test("documentation with attributes should be unmarshalled correctly", async () => {
    await withTmpDir(async (tmpDir) => {
      // Load XMLSchema.xsd
      const xsdPath = path.join(__dirname, "test-resources", "XMLSchema.xsd");
      const xmlSchemaXsd = readFileSync(xsdPath, "utf-8");

      // Generate TypeScript classes
      setupGeneratedRuntime(tmpDir, [xmlSchemaXsd]);

      // Get the schema class
      const { schema: Schema } = await loadGeneratedClasses(tmpDir, ["schema"]);

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
      const exampleElement = firstOrSelf(result.element);
      const annotation = firstOrSelf(exampleElement?.annotation);
      const documentation = firstOrSelf(annotation?.documentation);
      expect(documentation).toBeDefined();
      expect(documentation.value).toBe("documentation with source attribute");
      expect(documentation.source).toBe("http://example.com");
    });
  }, 30000);
});
