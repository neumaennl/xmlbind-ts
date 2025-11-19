import { readFileSync } from "fs";
import path from "path";
import { withTmpDir } from "./test-utils/temp-dir";
import { setupGeneratedRuntime } from "./test-utils/generated-runtime";

describe("XSD Generator - Occurrence Handling", () => {
  const testResourcesDir = path.join(__dirname, "test-resources");
  const occurrencesXsdPath = path.join(testResourcesDir, "compositor-occurrences.xsd");
  const xmlSchemaXsdPath = path.join(testResourcesDir, "XMLSchema.xsd");

  describe("maxOccurs on compositors", () => {
    test("elements in compositors with maxOccurs > 1 are arrays", () => {
      withTmpDir((tmpDir) => {
        const xsd = readFileSync(occurrencesXsdPath, "utf-8");
        setupGeneratedRuntime(tmpDir, [xsd]);

        const content = readFileSync(path.join(tmpDir, "groupInUnboundedSequence.ts"), "utf8");
        
        // Elements from group inside unbounded sequence should be arrays
        expect(content).toContain("array: true");
        expect(content).toMatch(/item\?:\s*String\[\]/);
        expect(content).toMatch(/note\?:\s*String\[\]/);
      });
    });

    test("nested compositors with different maxOccurs values", () => {
      withTmpDir((tmpDir) => {
        const xsd = readFileSync(occurrencesXsdPath, "utf-8");
        setupGeneratedRuntime(tmpDir, [xsd]);

        const content = readFileSync(path.join(tmpDir, "nestedMaxOccurs.ts"), "utf8");
        
        // Elements in unbounded choice should be arrays (optional because inside choice)
        expect(content).toMatch(/option1\?:\s*String\[\]/);
        expect(content).toMatch(/option2\?:\s*Number\[\]/);
        
        // Element in sequence with maxOccurs="5" should be array and required
        expect(content).toMatch(/repeated!:\s*String\[\]/);
        
        // Single element with default maxOccurs="1" should not be array
        expect(content).toMatch(/single!:\s*String;/);
        expect(content).not.toMatch(/single.*:\s*String\[\]/);
      });
    });

    test("combines element maxOccurs with compositor maxOccurs", () => {
      withTmpDir((tmpDir) => {
        const xsd = readFileSync(occurrencesXsdPath, "utf-8");
        setupGeneratedRuntime(tmpDir, [xsd]);

        const content = readFileSync(path.join(tmpDir, "combinedMaxOccurs.ts"), "utf8");
        
        // Both elements should be arrays because sequence has maxOccurs="unbounded"
        expect(content).toMatch(/item!:\s*String\[\]/);
        expect(content).toMatch(/single!:\s*String\[\]/);
      });
    });

    test("XMLSchema.xsd schema element has array properties", () => {
      withTmpDir((tmpDir) => {
        const xsd = readFileSync(xmlSchemaXsdPath, "utf-8");
        setupGeneratedRuntime(tmpDir, [xsd]);

        const schemaContent = readFileSync(path.join(tmpDir, "schema.ts"), "utf8");
        
        // Verify that the 'element' property is an array (from schemaTop group inside unbounded sequence)
        expect(schemaContent).toContain("@XmlElement('element'");
        expect(schemaContent).toMatch(/@XmlElement\('element',\s*\{[^}]*array:\s*true[^}]*\}/);
        expect(schemaContent).toMatch(/element\?:\s*topLevelElement\[\]/);
        
        // Verify other elements from schemaTop group are also arrays
        expect(schemaContent).toMatch(/simpleType\?:\s*topLevelSimpleType\[\]/);
        expect(schemaContent).toMatch(/complexType\?:\s*topLevelComplexType\[\]/);
        expect(schemaContent).toMatch(/group\?:\s*namedGroup\[\]/);
        expect(schemaContent).toMatch(/attributeGroup\?:\s*namedAttributeGroup\[\]/);
      });
    });
  });

  describe("minOccurs on compositors", () => {
    test("elements in compositors with minOccurs=0 are optional", () => {
      withTmpDir((tmpDir) => {
        const xsd = readFileSync(occurrencesXsdPath, "utf-8");
        setupGeneratedRuntime(tmpDir, [xsd]);

        const content = readFileSync(path.join(tmpDir, "optionalCompositors.ts"), "utf8");
        
        // Element in optional sequence should be optional
        expect(content).toMatch(/optionalSeqElement\?:\s*String;/);
        
        // Elements in optional choice should be optional
        expect(content).toMatch(/optionalChoiceElement1\?:\s*String;/);
        expect(content).toMatch(/optionalChoiceElement2\?:\s*Number;/);
        
        // Required element should be required
        expect(content).toMatch(/requiredElement!:\s*String;/);
      });
    });

    test("nested optional compositors propagate optionality", () => {
      withTmpDir((tmpDir) => {
        const xsd = readFileSync(occurrencesXsdPath, "utf-8");
        setupGeneratedRuntime(tmpDir, [xsd]);

        const content = readFileSync(path.join(tmpDir, "nestedOptional.ts"), "utf8");
        
        // Element in nested optional sequence should be optional
        expect(content).toMatch(/deeplyNested\?:\s*String;/);
      });
    });
  });

  describe("minOccurs and maxOccurs on elements", () => {
    test("elements with minOccurs=0 are optional", () => {
      withTmpDir((tmpDir) => {
        const xsd = readFileSync(occurrencesXsdPath, "utf-8");
        setupGeneratedRuntime(tmpDir, [xsd]);

        const content = readFileSync(path.join(tmpDir, "elementMinOccurs.ts"), "utf8");
        
        // Element with minOccurs="0" should be optional
        expect(content).toMatch(/optional\?:\s*String;/);
        
        // Element with default minOccurs="1" should be required
        expect(content).toMatch(/required!:\s*String;/);
      });
    });

    test("elements with minOccurs > 1 are arrays", () => {
      withTmpDir((tmpDir) => {
        const xsd = readFileSync(occurrencesXsdPath, "utf-8");
        setupGeneratedRuntime(tmpDir, [xsd]);

        const content = readFileSync(path.join(tmpDir, "minOccursGreaterThanOne.ts"), "utf8");
        
        // Element with minOccurs="2" should be array and required
        expect(content).toMatch(/multipleRequired!:\s*String\[\]/);
        
        // Element with minOccurs="2" maxOccurs="unbounded" should be array and required
        expect(content).toMatch(/multipleOptional!:\s*String\[\]/);
        
        // Element with minOccurs="0" should not be array and optional
        expect(content).toMatch(/singleOptional\?:\s*String;/);
        
        // Element with default minOccurs="1" should not be array and required
        expect(content).toMatch(/singleRequired!:\s*String;/);
      });
    });
  });
});
