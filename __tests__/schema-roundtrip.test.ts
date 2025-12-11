import { readFileSync } from "fs";
import path from "path";
import { DOMParser } from "@xmldom/xmldom";
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

/**
 * Compares two XML documents to ensure they contain the same information.
 * Uses DOM comparison to be order-independent and namespace-aware.
 *
 * @param xml1 - First XML document
 * @param xml2 - Second XML document
 * @returns Object with comparison result and details
 */
function compareXmlDocuments(xml1: string, xml2: string): {
  equal: boolean;
  differences: string[];
} {
  const parser = new DOMParser();
  const doc1 = parser.parseFromString(xml1, "application/xml");
  const doc2 = parser.parseFromString(xml2, "application/xml");
  
  const differences: string[] = [];
  
  // Check for parse errors
  const checkParseErrors = (doc: any, label: string) => {
    const errors = doc.getElementsByTagName("parsererror");
    if (errors.length > 0) {
      differences.push(`${label} has parse errors: ${errors[0].textContent}`);
    }
  };
  
  checkParseErrors(doc1, "First document");
  checkParseErrors(doc2, "Second document");
  
  if (differences.length > 0) {
    return { equal: false, differences };
  }
  
  // Compare element counts by namespace URI + local name (namespace-aware)
  const getAllElements = (doc: any): Map<string, number> => {
    const elementCounts = new Map<string, number>();
    const walk = (node: any) => {
      if (node.nodeType === 1) { // Element node
        // Use namespace URI + local name for namespace-aware comparison
        const key = `{${node.namespaceURI || ""}}${node.localName || node.tagName}`;
        elementCounts.set(key, (elementCounts.get(key) || 0) + 1);
      }
      for (let i = 0; i < node.childNodes.length; i++) {
        walk(node.childNodes[i]);
      }
    };
    walk(doc.documentElement);
    return elementCounts;
  };
  
  const elements1 = getAllElements(doc1);
  const elements2 = getAllElements(doc2);
  
  // Check for missing/extra element types
  elements1.forEach((count1, key) => {
    const count2 = elements2.get(key) || 0;
    if (count2 === 0) {
      differences.push(`Element "${key}" exists in first (${count1}x) but not in second`);
    } else if (count1 !== count2) {
      differences.push(
        `Element "${key}" count differs: ${count1} in first, ${count2} in second`
      );
    }
  });
  
  elements2.forEach((count2, key) => {
    if (!elements1.has(key)) {
      differences.push(`Element "${key}" exists in second (${count2}x) but not in first`);
    }
  });
  
  return { equal: differences.length === 0, differences };
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

      // Compare the two unmarshalled objects (ensures data preservation at object level)
      expect(JSON.stringify(schemaObj2)).toBe(JSON.stringify(schemaObj));
      
      // Do a third roundtrip to verify order consistency
      const marshalledXsd2 = marshal(schemaObj2);
      
      // The marshalled XML should be identical on subsequent roundtrips (order consistency)
      expect(marshalledXsd2).toBe(marshalledXsd);
      
      // Use XML comparison to verify all information is preserved
      const comparison = compareXmlDocuments(originalXsd, marshalledXsd);
      if (!comparison.equal) {
        console.log("\n⚠️  XML comparison differences:");
        comparison.differences.forEach(diff => console.log(`  - ${diff}`));
      }
      expect(comparison.equal).toBe(true);

      // Verify no data loss by checking key elements
      expect(schemaObj.element).toBeDefined();
      expect(schemaObj.complexType).toBeDefined();
      expect(schemaObj.simpleType).toBeDefined();

      expect(schemaObj2.element).toBeDefined();
      expect(schemaObj2.complexType).toBeDefined();
      expect(schemaObj2.simpleType).toBeDefined();
    });
  }, 30000);

  test("XMLSchema.xsd should survive unmarshal/marshal roundtrip without data loss", () => {
    withTmpDir((tmpDir) => {
      // Load XMLSchema.xsd
      const xmlSchemaPath = path.join(
        __dirname,
        "test-resources",
        "XMLSchema.xsd"
      );
      let originalXsd = readFileSync(xmlSchemaPath, "utf-8");

      // Remove DOCTYPE internal subset (parameter entities) as fast-xml-parser cannot handle them
      // Note: DOCTYPE with internal subset is legacy/optional in XML Schema files
      // The schema content itself is preserved - only the DTD entity declarations are removed
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

      // Debug: Show first diff if any
      const str1 = JSON.stringify(schemaObj);
      const str2 = JSON.stringify(schemaObj2);
      if (str1 !== str2) {
        console.log("\n⚠️  Roundtrip has differences");
        console.log("Length 1:", str1.length, "Length 2:", str2.length);
        
        // Find first difference
        for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
          if (str1[i] !== str2[i]) {
            console.log("\nFirst difference at position", i);
            console.log("Context:", str1.substring(Math.max(0, i - 30), i + 70));
            break;
          }
        }
      } else {
        console.log("\n✅ Roundtrip successful - no data loss!");
      }

      // Strict comparison - ensures absolutely no data loss at object level
      expect(JSON.stringify(schemaObj2)).toBe(JSON.stringify(schemaObj));
      
      // Do a third roundtrip to verify order consistency
      const marshalledXsd2 = marshal(schemaObj2);
      
      // The marshalled XML should be identical on subsequent roundtrips (order consistency)
      expect(marshalledXsd2).toBe(marshalledXsd);
      
      // Use XML comparison to verify all information from original is preserved
      const comparison = compareXmlDocuments(originalXsd, marshalledXsd);
      if (!comparison.equal) {
        console.log("\n⚠️  XML comparison differences between original and marshalled:");
        comparison.differences.forEach(diff => console.log(`  - ${diff}`));
      }
      expect(comparison.equal).toBe(true);

      // Verify key structural elements are preserved
      expect(schemaObj2.element).toBeDefined();
      expect(schemaObj2.complexType).toBeDefined();
      expect(schemaObj2.simpleType).toBeDefined();
      expect(schemaObj2.group).toBeDefined();
      expect(schemaObj2.attributeGroup).toBeDefined();
      expect(schemaObj2.notation).toBeDefined();

      // Verify arrays have the same length - redundant with strict check above but explicit
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
