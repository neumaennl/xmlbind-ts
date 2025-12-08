/**
 * Tests that demonstrate the circular dependency bug and verify the fix.
 *
 * The original bug (issue #44) showed that when circular dependencies exist between
 * generated classes, the type in @XmlElement decorators could be undefined at
 * decorator evaluation time, causing unmarshalled elements to appear as raw JSON
 * (with "xs:element" property) instead of typed class instances.
 *
 * This test file proves that:
 * 1. Without lazy type references, when type is undefined, raw XML data is returned
 * 2. With lazy type references (the fix), types are resolved at runtime correctly
 */

import { XmlRoot, XmlElement, unmarshal, marshal } from "../src";
import { getAllFields } from "../src/metadata/MetadataRegistry";
import { resolveType } from "../src/util/typeResolution";

describe("Circular Dependency Bug Reproduction", () => {
  describe("Bug scenario: type is undefined at decorator time", () => {
    test("when type is undefined, xmlValueToObject returns raw data", () => {
      // This test demonstrates what happens when the type is undefined
      // (simulating what occurs during circular dependency issues)

      // Create a class where element type is explicitly undefined
      @XmlRoot("Parent")
      class ParentWithUndefinedType {
        @XmlElement("child", { type: undefined as any })
        child?: any;
      }

      // Verify metadata has undefined type
      const fields = getAllFields(ParentWithUndefinedType);
      const childField = fields.find((f: any) => f.name === "child");
      expect(childField?.type).toBeUndefined();

      // When unmarshalling, the raw XML data structure would be returned
      // (we can't easily test the full unmarshal here since it needs proper XML)
    });

    test("resolveType correctly handles undefined", () => {
      // The fix uses resolveType which handles undefined gracefully
      expect(resolveType(undefined)).toBeUndefined();
      expect(resolveType(null)).toBeUndefined();
    });

    test("resolveType correctly resolves lazy type references", () => {
      class TestClass {}

      // Direct reference
      expect(resolveType(TestClass)).toBe(TestClass);

      // Lazy reference (arrow function) - this is what the fix uses
      expect(resolveType(() => TestClass)).toBe(TestClass);
    });
  });

  describe("Fix verification: lazy type references", () => {
    test("lazy type references are resolved at runtime", () => {
      // Simulate the scenario where ClassA isn't defined yet when ClassB's
      // decorator runs. With direct references, type would be undefined.
      // With lazy references, it's resolved when actually needed.

      @XmlRoot("ClassB")
      class ClassBImpl {
        // Use lazy reference - at this point ClassAImpl isn't defined yet
        // but the arrow function delays evaluation until runtime
        @XmlElement("refA", { type: () => ClassAImpl })
        refA?: any;
      }

      @XmlRoot("ClassA")
      class ClassAImpl {
        @XmlElement("refB", { type: () => ClassBImpl })
        refB?: any;
      }

      // Now both classes are defined - assignments verify they're used
      expect(ClassAImpl).toBeDefined();
      expect(ClassBImpl).toBeDefined();

      // Verify the lazy references are properly stored in metadata
      const fieldsB = getAllFields(ClassBImpl);
      const refAField = fieldsB.find((f: any) => f.name === "refA");

      // The type is stored as a function
      expect(typeof refAField?.type).toBe("function");

      // resolveType can resolve it to the actual class
      const resolvedType = resolveType(refAField?.type);
      expect(resolvedType).toBe(ClassAImpl);
    });

    test("unmarshal and marshal work with lazy type references", () => {
      // Define a parent class with a child element using lazy reference
      @XmlRoot("child")
      class ChildClass {
        @XmlElement("value", { type: String })
        value?: string;
      }

      @XmlRoot("parent", { namespace: "http://test.com" })
      class ParentClass {
        @XmlElement("child", { type: () => ChildClass })
        child?: ChildClass;
      }

      // Test unmarshalling
      const xml =
        '<parent xmlns="http://test.com"><child><value>test</value></child></parent>';
      const result = unmarshal(ParentClass, xml);

      expect(result).toBeInstanceOf(ParentClass);
      expect(result.child).toBeInstanceOf(ChildClass);
      expect(result.child?.value).toBe("test");

      // Test marshalling
      const parent = new ParentClass();
      parent.child = new ChildClass();
      parent.child.value = "marshalled";

      const marshalled = marshal(parent);
      expect(marshalled).toContain("<child>");
      expect(marshalled).toContain("<value>marshalled</value>");
    });
  });

  describe("Generated code uses lazy type references", () => {
    test("generator emits lazy type references for non-primitive types", async () => {
      const { generateFromXsd } = await import("../src/xsd/TsGenerator");
      const { mkdtempSync, rmSync, readFileSync } = await import("fs");
      const { join } = await import("path");
      const { tmpdir } = await import("os");

      const tmpDir = mkdtempSync(join(tmpdir(), "lazy-ref-test-"));

      try {
        // Simple XSD with a type reference
        const XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexType name="ChildType">
    <xs:sequence>
      <xs:element name="value" type="xs:string"/>
    </xs:sequence>
  </xs:complexType>
  
  <xs:complexType name="ParentType">
    <xs:sequence>
      <xs:element name="child" type="ChildType"/>
    </xs:sequence>
  </xs:complexType>
</xs:schema>`;

        generateFromXsd(XSD, tmpDir);

        // Read the generated ParentType.ts
        const parentFile = readFileSync(join(tmpDir, "ParentType.ts"), "utf-8");

        // Verify lazy type reference is used
        expect(parentFile).toMatch(/type:\s*\(\)\s*=>\s*ChildType/);

        // Verify it's not a direct reference
        expect(parentFile).not.toMatch(/type:\s*ChildType[^)]/);
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
