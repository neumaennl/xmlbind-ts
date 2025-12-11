import { readFileSync } from "fs";
import path from "path";
import { withTmpDir } from "./test-utils/temp-dir";
import {
  setupGeneratedRuntime,
  loadGeneratedClasses,
} from "./test-utils/generated-runtime";
import { unmarshal } from "../src/marshalling/unmarshal";
import { marshal } from "../src/marshalling/marshal";

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
      originalXsd = originalXsd.replace(/<!DOCTYPE[^>]*\[[\s\S]*?\]>/m, "");

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
      if (Array.isArray(schemaObj.element)) {
        expect(schemaObj2.element).toHaveLength(schemaObj.element.length);
      }
      if (Array.isArray(schemaObj.complexType)) {
        expect(schemaObj2.complexType).toHaveLength(
          schemaObj.complexType.length
        );
      }
      if (Array.isArray(schemaObj.simpleType)) {
        expect(schemaObj2.simpleType).toHaveLength(schemaObj.simpleType.length);
      }
      if (Array.isArray(schemaObj.group)) {
        expect(schemaObj2.group).toHaveLength(schemaObj.group.length);
      }
      if (Array.isArray(schemaObj.attributeGroup)) {
        expect(schemaObj2.attributeGroup).toHaveLength(schemaObj.attributeGroup.length);
      }
      if (Array.isArray(schemaObj.notation)) {
        expect(schemaObj2.notation).toHaveLength(schemaObj.notation.length);
      }

      // Verify specific important elements exist
      const findElement = (arr: any[], name: string) => 
        Array.isArray(arr) ? arr.find((e: any) => e.name === name) : undefined;

      const schema1 = findElement(schemaObj.element as any[], "schema");
      const schema2 = findElement(schemaObj2.element as any[], "schema");
      expect(schema1).toBeDefined();
      expect(schema2).toBeDefined();
      if (schema1 && schema2) {
        expect(schema2.name).toBe(schema1.name);
      }

      // Check a complexType
      const openAttrs1 = findElement(schemaObj.complexType as any[], "openAttrs");
      const openAttrs2 = findElement(schemaObj2.complexType as any[], "openAttrs");
      expect(openAttrs1).toBeDefined();
      expect(openAttrs2).toBeDefined();
    });
  }, 30000);
});
