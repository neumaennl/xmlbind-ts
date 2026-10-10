/**
 * Tests for Stage 3 decorator support (without experimentalDecorators flag)
 *
 * Vitest runs this file in two projects (see vitest.config.mts):
 * - legacy-decorators: compiled with experimentalDecorators and emitDecoratorMetadata
 * - stage3-decorators: compiled with Stage 3 decorators
 */

import {
  XmlRoot,
  XmlElement,
  XmlAttribute,
  XmlAnyAttribute,
  XmlAnyElement,
  XmlText,
  XmlEnum,
  marshal,
  unmarshal,
  getMeta,
  getAllFields,
} from "../src/index.js";
import {
  decoratorMode,
  detectDecoratorMode,
  expectStringsOnSameLine,
} from "./test-utils/index.js";

enum TestEnum {
  Value1 = "value1",
  Value2 = "value2",
}

describe("Stage 3 Decorators Support", () => {
  test("decorators are compiled in the mode of the Vitest project", () => {
    expect(detectDecoratorMode()).toBe(decoratorMode);
  });

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
    // Verify that attributes appear on the same line as the opening tag
    const firstLine = xml.split("\n")[0];
    expectStringsOnSameLine(firstLine, [
      "<MarshalTest",
      'id="123"',
      'custom1="a"',
      'custom2="b"',
    ]);
    expect(xml).toContain("<value>test</value>");
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

    // Verify attributes are on the opening tag line
    const firstLine1 = xml1.split("\n")[0];
    expectStringsOnSameLine(firstLine1, ["<MultiInstance", 'id="1"']);
    expect(xml1).toContain("<value>first</value>");

    const firstLine2 = xml2.split("\n")[0];
    expectStringsOnSameLine(firstLine2, ["<MultiInstance", 'id="2"']);
    expect(xml2).toContain("<value>second</value>");
  });

  test("should register fields when the class is defined", () => {
    @XmlRoot("Defined")
    class Defined {
      @XmlAttribute("id")
      id?: string;

      @XmlElement("value")
      value?: string;
    }

    expect(getMeta(Defined)?.fields.map((f) => f.key)).toEqual(["id", "value"]);
  });

  test("should not duplicate fields when the class is instantiated", () => {
    @XmlRoot("Repeated")
    class Repeated {
      @XmlEnum(TestEnum)
      @XmlElement("status")
      status?: TestEnum;
    }

    for (let i = 0; i < 3; i++) new Repeated();

    const fields = getMeta(Repeated)?.fields ?? [];
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({ key: "status", enumType: TestEnum });
  });

  test("should register fields of classes without @XmlRoot", () => {
    class Child {
      @XmlElement("name")
      name?: string;
    }

    @XmlRoot("Parent")
    class Parent {
      @XmlElement("child", { type: Child })
      child?: Child;
    }

    expect(getMeta(Child)?.fields.map((f) => f.key)).toEqual(["name"]);

    const parent = unmarshal(
      Parent,
      "<Parent><child><name>Ann</name></child></Parent>"
    );
    expect(parent.child).toBeInstanceOf(Child);
    expect(parent.child?.name).toBe("Ann");
  });

  test("should keep fields of base and derived classes apart", () => {
    class Base {
      @XmlAttribute("id")
      id?: string;
    }

    @XmlRoot("Derived")
    class Derived extends Base {
      @XmlElement("value")
      value?: string;
    }

    new Derived();

    expect(getMeta(Base)?.fields.map((f) => f.key)).toEqual(["id"]);
    expect(getMeta(Derived)?.fields.map((f) => f.key)).toEqual(["value"]);
    expect(getAllFields(Derived).map((f) => f.key)).toEqual(["id", "value"]);

    const obj = new Derived();
    obj.id = "7";
    obj.value = "derived";
    const xml = marshal(obj);
    expectStringsOnSameLine(xml.split("\n")[0], ["<Derived", 'id="7"']);
    expect(xml).toContain("<value>derived</value>");
  });

  test("should convert values with an explicit type option", () => {
    @XmlRoot("Typed")
    class Typed {
      @XmlAttribute("count", { type: Number })
      count?: number;

      @XmlElement("flag", { type: Boolean })
      flag?: boolean;
    }

    const result = unmarshal(Typed, '<Typed count="3"><flag>1</flag></Typed>');
    expect(result.count).toBe(3);
    expect(result.flag).toBe(true);
  });

  test("should register fields once per class with addInitializer when context.metadata is missing", () => {
    const initializers: Array<(this: unknown) => void> = [];
    const context = (name: string) => ({
      kind: "field",
      name,
      addInitializer: (initializer: (this: unknown) => void) => {
        initializers.push(initializer);
      },
    });

    class Manual {
      status?: TestEnum;
    }
    XmlElement("status")(undefined, context("status"));
    XmlEnum(TestEnum)(undefined, context("status"));

    expect(getMeta(Manual)).toBeUndefined();

    for (let i = 0; i < 3; i++) {
      const instance = new Manual();
      for (const initializer of initializers) initializer.call(instance);
    }

    const fields = getMeta(Manual)?.fields ?? [];
    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({ key: "status", enumType: TestEnum });
  });
});
