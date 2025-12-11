import { readFileSync } from "fs";
import path from "path";
import { withTmpDir } from "./test-utils/temp-dir";
import {
  setupGeneratedRuntime,
  loadGeneratedClasses,
} from "./test-utils/generated-runtime";
import { unmarshal } from "../src/marshalling/unmarshal";
import { marshal } from "../src/marshalling/marshal";

/**
 * Removes DOCTYPE declaration from XML content.
 * DOCTYPE declarations can cause parsing issues with fast-xml-parser,
 * especially when they contain entity definitions.
 *
 * @param xml - The XML content
 * @returns The XML content without the DOCTYPE declaration
 */
function removeDoctypeDeclaration(xml: string): string {
  // Pattern matches DOCTYPE declarations with internal subset
  // Uses [\s\S] to match any character including newlines
  return xml.replace(/<!DOCTYPE\s+[^[>]*\[[\s\S]*?\]>/gim, "");
}

describe("Schema Roundtrip", () => {
  test("example.xsd should survive unmarshal/marshal roundtrip without data loss", () => {
    withTmpDir((tmpDir) => {
      // Load XMLSchema.xsd to generate TypeScript classes
      const xmlSchemaPath = path.join(
        __dirname,
        "test-resources",
        "XMLSchema.xsd"
      );
      const xmlSchemaXsd = readFileSync(xmlSchemaPath, "utf-8");

      // Generate TypeScript classes from XMLSchema.xsd
      console.log("Generating TypeScript classes from XMLSchema.xsd...");
      setupGeneratedRuntime(tmpDir, [xmlSchemaXsd]);

      // Get the schema class
      const { schema: Schema } = loadGeneratedClasses(tmpDir, ["schema"]);

      // Load example.xsd
      const examplePath = path.join(__dirname, "test-resources", "example.xsd");
      const originalXsd = readFileSync(examplePath, "utf-8");

      console.log("Original XSD:");
      console.log(originalXsd);

      // Unmarshal the example.xsd
      const schemaObj = unmarshal(Schema, originalXsd) as any;

      console.log("\nUnmarshalled schema object:");
      console.log(JSON.stringify(schemaObj, null, 2));

      // Marshal it back to XML
      const marshalledXsd = marshal(schemaObj);

      console.log("\nMarshalled XSD:");
      console.log(marshalledXsd);

      // Unmarshal again to compare
      const schemaObj2 = unmarshal(Schema, marshalledXsd) as any;

      console.log("\nUnmarshalled again:");
      console.log(JSON.stringify(schemaObj2, null, 2));

      // Compare the two unmarshalled objects
      expect(JSON.stringify(schemaObj2)).toBe(JSON.stringify(schemaObj));

      // Verify no data loss by checking key elements
      expect(schemaObj.element).toBeDefined();
      expect(schemaObj.complexType).toBeDefined();
      expect(schemaObj.simpleType).toBeDefined();

      expect(schemaObj2.element).toBeDefined();
      expect(schemaObj2.complexType).toBeDefined();
      expect(schemaObj2.simpleType).toBeDefined();
    });
  }, 30000);

  test("XMLSchema.xsd should survive unmarshal/marshal roundtrip with minimal data loss", () => {
    withTmpDir((tmpDir) => {
      // Load XMLSchema.xsd
      const xmlSchemaPath = path.join(
        __dirname,
        "test-resources",
        "XMLSchema.xsd"
      );
      let originalXsd = readFileSync(xmlSchemaPath, "utf-8");

      // Remove DOCTYPE and entity declarations as they cause parsing issues
      // This is acceptable for the roundtrip test as DTD content is not part of the schema structure
      originalXsd = removeDoctypeDeclaration(originalXsd);

      // Generate TypeScript classes from XMLSchema.xsd
      console.log("Generating TypeScript classes from XMLSchema.xsd...");
      setupGeneratedRuntime(tmpDir, [originalXsd]);

      // Get the schema class
      const { schema: Schema } = loadGeneratedClasses(tmpDir, ["schema"]);

      // Unmarshal the XMLSchema.xsd itself
      const schemaObj = unmarshal(Schema, originalXsd) as any;

      // Marshal it back to XML
      const marshalledXsd = marshal(schemaObj);

      // Unmarshal again to compare
      const schemaObj2 = unmarshal(Schema, marshalledXsd) as any;

      // Verify key structural elements are preserved
      expect(schemaObj2.element).toBeDefined();
      expect(schemaObj2.complexType).toBeDefined();
      expect(schemaObj2.simpleType).toBeDefined();
      expect(schemaObj2.group).toBeDefined();
      expect(schemaObj2.attributeGroup).toBeDefined();
      expect(schemaObj2.notation).toBeDefined();

      // Verify arrays have the same length - this ensures no elements are lost
      expect(Array.isArray(schemaObj.element)).toBe(true);
      expect(Array.isArray(schemaObj2.element)).toBe(true);
      expect(schemaObj2.element).toHaveLength(
        Array.isArray(schemaObj.element) ? schemaObj.element.length : 0
      );

      expect(Array.isArray(schemaObj.complexType)).toBe(true);
      expect(Array.isArray(schemaObj2.complexType)).toBe(true);
      expect(schemaObj2.complexType).toHaveLength(
        Array.isArray(schemaObj.complexType) ? schemaObj.complexType.length : 0
      );

      expect(Array.isArray(schemaObj.simpleType)).toBe(true);
      expect(Array.isArray(schemaObj2.simpleType)).toBe(true);
      expect(schemaObj2.simpleType).toHaveLength(
        Array.isArray(schemaObj.simpleType) ? schemaObj.simpleType.length : 0
      );

      expect(Array.isArray(schemaObj.group)).toBe(true);
      expect(Array.isArray(schemaObj2.group)).toBe(true);
      expect(schemaObj2.group).toHaveLength(
        Array.isArray(schemaObj.group) ? schemaObj.group.length : 0
      );

      expect(Array.isArray(schemaObj.attributeGroup)).toBe(true);
      expect(Array.isArray(schemaObj2.attributeGroup)).toBe(true);
      expect(schemaObj2.attributeGroup).toHaveLength(
        Array.isArray(schemaObj.attributeGroup)
          ? schemaObj.attributeGroup.length
          : 0
      );

      expect(Array.isArray(schemaObj.notation)).toBe(true);
      expect(Array.isArray(schemaObj2.notation)).toBe(true);
      expect(schemaObj2.notation).toHaveLength(
        Array.isArray(schemaObj.notation) ? schemaObj.notation.length : 0
      );

      // Verify specific important elements exist
      const findElement = (arr: any[], name: string) =>
        Array.isArray(arr) ? arr.find((e: any) => e.name === name) : undefined;

      const schema1 = findElement(schemaObj.element as any[], "schema");
      const schema2 = findElement(schemaObj2.element as any[], "schema");
      expect(schema1).toBeDefined();
      expect(schema2).toBeDefined();
      expect(schema1?.name).toBe(schema2?.name);

      // Check a complexType
      const openAttrs1 = findElement(
        schemaObj.complexType as any[],
        "openAttrs"
      );
      const openAttrs2 = findElement(
        schemaObj2.complexType as any[],
        "openAttrs"
      );
      expect(openAttrs1).toBeDefined();
      expect(openAttrs2).toBeDefined();
    });
  }, 30000);
});
