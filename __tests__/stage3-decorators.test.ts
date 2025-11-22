/**
 * Tests for Stage 3 decorator support (without experimentalDecorators flag)
 * 
 * This test file verifies that decorators work correctly with both:
 * - Legacy decorators (with experimentalDecorators: true)
 * - Stage 3 decorators (without experimentalDecorators)
 */

import { XmlRoot, XmlElement, XmlAttribute, XmlAnyAttribute, XmlAnyElement, XmlText, XmlEnum, marshal, getMeta } from "../src";
import { expectConsecutiveStrings } from "./test-utils";

enum TestEnum {
  Value1 = "value1",
  Value2 = "value2",
}

describe("Stage 3 Decorators Support", () => {
  test("should work with all decorators in a complex class", () => {
    @XmlRoot("ComplexTest")
    class ComplexTest {
      @XmlAttribute("id")
      id?: string;

      @XmlElement("name", { type: String })
      name?: string;

      @XmlElement("items", { type: String, array: true })
      items?: string[];

      @XmlText()
      textContent?: string;

      @XmlAnyElement()
      anyElements?: unknown[];

      @XmlAnyAttribute()
      anyAttributes?: { [name: string]: string };

      @XmlEnum(TestEnum)
      @XmlElement("status")
      status?: TestEnum;
    }

    // Verify metadata is registered
    const meta = getMeta(ComplexTest);
    expect(meta).toBeDefined();
    expect(meta?.rootName).toBe("ComplexTest");
    
    const fields = meta?.fields || [];
    expect(fields.length).toBeGreaterThan(0);
    
    // Verify each field type is registered
    const idField = fields.find((f: any) => f.key === "id");
    expect(idField).toBeDefined();
    expect((idField as any)?.kind).toBe("attribute");
    
    const nameField = fields.find((f: any) => f.key === "name");
    expect(nameField).toBeDefined();
    expect((nameField as any)?.kind).toBe("element");
    
    const anyAttrField = fields.find((f: any) => f.key === "anyAttributes");
    expect(anyAttrField).toBeDefined();
    expect((anyAttrField as any)?.kind).toBe("anyAttribute");
  });

  test("should create instances without errors", () => {
    @XmlRoot("TestClass")
    class TestClass {
      @XmlAttribute("attr")
      attr?: string;

      @XmlElement("elem")
      elem?: string;

      @XmlAnyAttribute()
      anyAttrs?: { [name: string]: string };
    }

    // This should not throw any errors
    expect(() => {
      const instance = new TestClass();
      instance.attr = "test";
      instance.elem = "value";
      instance.anyAttrs = { custom: "attr" };
    }).not.toThrow();
  });

  test("should marshal correctly with all decorator types", () => {
    @XmlRoot("MarshalTest")
    class MarshalTest {
      @XmlAttribute("id")
      id?: string;

      @XmlElement("value")
      value?: string;

      @XmlAnyAttribute()
      extraAttrs?: { [name: string]: string };
    }

    const obj = new MarshalTest();
    obj.id = "123";
    obj.value = "test";
    obj.extraAttrs = { custom1: "a", custom2: "b" };

    const xml = marshal(obj);
    expectConsecutiveStrings(xml, [
      "<MarshalTest",
      'id="123"',
      'custom1="a"',
      'custom2="b"',
      "<value>test</value>",
    ]);
  });

  test("should handle enum decorators", () => {
    @XmlRoot("EnumTest")
    class EnumTest {
      @XmlEnum(TestEnum)
      @XmlElement("status")
      status?: TestEnum;
    }

    const meta = getMeta(EnumTest);
    const statusField = meta?.fields.find((f: any) => f.key === "status");
    expect(statusField).toBeDefined();
    expect((statusField as any)?.enumType).toBe(TestEnum);
  });

  test("should handle multiple instances of the same class", () => {
    @XmlRoot("MultiInstance")
    class MultiInstance {
      @XmlAttribute("id")
      id?: string;

      @XmlElement("value")
      value?: string;
    }

    // Create multiple instances
    const instance1 = new MultiInstance();
    instance1.id = "1";
    instance1.value = "first";

    const instance2 = new MultiInstance();
    instance2.id = "2";
    instance2.value = "second";

    // Both should work correctly
    const xml1 = marshal(instance1);
    const xml2 = marshal(instance2);

    expectConsecutiveStrings(xml1, ['id="1"', "<value>first</value>"]);
    expectConsecutiveStrings(xml2, ['id="2"', "<value>second</value>"]);
  });
});
