import { XmlAnyAttribute } from "../src/decorators/XmlAnyAttribute";
import { XmlAnyElement } from "../src/decorators/XmlAnyElement";
import { XmlAttribute } from "../src/decorators/XmlAttribute";
import { XmlElement } from "../src/decorators/XmlElement";
import { XmlEnum } from "../src/decorators/XmlEnum";
import { XmlRoot } from "../src/decorators/XmlRoot";
import { XmlText } from "../src/decorators/XmlText";
import { getMeta } from "../src/metadata/MetadataRegistry";
import { marshal, unmarshal } from "../src/marshalling";
import { expectStringsOnConsecutiveLines } from "./test-utils";

enum TestEnum {
  One = "one",
  Two = "two",
}

enum StatusEnum {
  Active = "active",
  Inactive = "inactive",
  Pending = "pending",
}

enum Priority {
  Low = "low",
  Medium = "medium",
  High = "high",
}

enum NumericEnum {
  First = 1,
  Second = 2,
  Third = 3,
}

describe("Decorators", () => {
  describe("XmlAttribute", () => {
    it("should handle attribute with namespace", () => {
      @XmlRoot("item")
      class Item {
        @XmlAttribute("id", { namespace: "http://example.com" })
        id?: string;
      }

      const meta = getMeta(Item);
      const idField = meta?.fields.find((f: any) => f.key === "id");
      expect(idField).toBeDefined();
      expect((idField as any).namespace).toBe("http://example.com");
    });

    it("should handle attribute with default name", () => {
      @XmlRoot("item")
      class Item {
        @XmlAttribute()
        count?: number;
      }

      const item = new Item();
      item.count = 42;
      const xml = marshal(item);
      expect(xml).toContain('count="42"');
    });

    it("should handle attribute without options", () => {
      @XmlRoot("item")
      class Item {
        @XmlAttribute("simple")
        simple?: string;
      }

      const meta = getMeta(Item);
      const simpleField = meta?.fields.find((f: any) => f.key === "simple");
      expect(simpleField).toBeDefined();
    });

    it("should work when decorator function is called manually (legacy API)", () => {
      class TestClass {
        testProp?: string;
      }

      const decorator = XmlAttribute("attrName");
      const returned = decorator({});

      expect(typeof returned).toBe("function");
      (returned as any)(TestClass.prototype, "testProp");

      const meta = getMeta(TestClass);
      expect(meta).toBeDefined();
      expect(meta?.fields.length).toBeGreaterThan(0);
    });

    it("should handle namespace in legacy path", () => {
      class TestClass {
        testProp?: string;
      }

      const decorator = XmlAttribute("attrName", {
        namespace: "http://test.com",
      });
      const returned = decorator({});

      expect(typeof returned).toBe("function");
      (returned as any)(TestClass.prototype, "testProp");

      const meta = getMeta(TestClass);
      const field = meta?.fields.find((f: any) => f.key === "testProp");
      expect((field as any)?.namespace).toBe("http://test.com");
    });
  });

  describe("XmlElement", () => {
    it("should handle element with namespace", () => {
      @XmlRoot("container")
      class Container {
        @XmlElement("item", { namespace: "http://example.com/ns" })
        item?: string;
      }

      const meta = getMeta(Container);
      const itemField = meta?.fields.find((f: any) => f.key === "item");
      expect(itemField).toBeDefined();
      expect((itemField as any).namespace).toBe("http://example.com/ns");
    });

    it("should handle element with array and type", () => {
      @XmlRoot("list")
      class List {
        @XmlElement("values", { type: Number, array: true })
        values?: number[];
      }

      const list = new List();
      list.values = [1, 2, 3];
      const xml = marshal(list);
      expectStringsOnConsecutiveLines(xml, [
        "<values>1</values>",
        "<values>2</values>",
        "<values>3</values>",
      ]);
    });

    it("should handle element with nested class", () => {
      @XmlRoot("child")
      class Child {
        @XmlElement("name")
        name?: string;
      }

      @XmlRoot("parent")
      class Parent {
        @XmlElement("child", { type: Child })
        child?: Child;
      }

      const parent = new Parent();
      parent.child = new Child();
      parent.child.name = "test";

      const xml = marshal(parent);
      expectStringsOnConsecutiveLines(xml, ["<child>", "<name>test</name>"]);
    });

    it("should handle element without options", () => {
      @XmlRoot("simple")
      class Simple {
        @XmlElement("value")
        value?: string;
      }

      const meta = getMeta(Simple);
      const valueField = meta?.fields.find((f: any) => f.key === "value");
      expect(valueField).toBeDefined();
    });

    it("should work when decorator function is called manually (legacy API)", () => {
      class TestClass {
        testProp?: string;
      }

      const decorator = XmlElement("elemName");
      const returned = decorator({});

      expect(typeof returned).toBe("function");
      (returned as any)(TestClass.prototype, "testProp");

      const meta = getMeta(TestClass);
      expect(meta).toBeDefined();
      expect(meta?.fields.length).toBeGreaterThan(0);
    });

    it("should handle options in legacy path", () => {
      class TestClass {
        testProp?: string;
      }

      const decorator = XmlElement("elemName", {
        namespace: "http://test.com",
        type: String,
        array: false,
      });
      const returned = decorator({});

      expect(typeof returned).toBe("function");
      (returned as any)(TestClass.prototype, "testProp");

      const meta = getMeta(TestClass);
      const field = meta?.fields.find((f: any) => f.key === "testProp");
      expect((field as any)?.namespace).toBe("http://test.com");
    });
  });

  describe("XmlRoot", () => {
    it("should handle root with namespace", () => {
      @XmlRoot("root", { namespace: "http://example.com" })
      class RootWithNs {
        @XmlElement("value")
        value?: string;
      }

      const meta = getMeta(RootWithNs);
      expect(meta).toBeDefined();
      expect((meta as any).namespace).toBe("http://example.com");
    });

    it("should handle root with prefixes", () => {
      @XmlRoot("root", {
        namespace: "http://example.com",
        prefixes: { "http://other.com": "other" },
      })
      class RootWithPrefixes {
        @XmlElement("value")
        value?: string;
      }

      const meta = getMeta(RootWithPrefixes);
      expect(meta).toBeDefined();
    });

    it("should handle root without options", () => {
      @XmlRoot("simple")
      class SimpleRoot {
        @XmlElement("value")
        value?: string;
      }

      const meta = getMeta(SimpleRoot);
      expect(meta).toBeDefined();
    });

    it("should work when decorator function is called manually (legacy API)", () => {
      const decorator = XmlRoot("rootName");
      const returned = decorator({});

      expect(typeof returned).toBe("function");
      class TestClass {}
      (returned as any)(TestClass);

      const meta = getMeta(TestClass);
      expect(meta).toBeDefined();
    });

    it("should handle options in legacy path", () => {
      const decorator = XmlRoot("rootName", {
        namespace: "http://test.com",
      });
      const returned = decorator({});

      expect(typeof returned).toBe("function");
      class TestClass {}
      (returned as any)(TestClass);

      const meta = getMeta(TestClass);
      expect((meta as any)?.namespace).toBe("http://test.com");
    });
  });

  describe("XmlText", () => {
    it("should handle text content", () => {
      @XmlRoot("wrapper")
      class Wrapper {
        @XmlText()
        content?: string;
      }

      const wrapper = new Wrapper();
      wrapper.content = "test text";
      const xml = marshal(wrapper);
      expect(xml).toContain(">test text</wrapper>");
    });

    it("should handle text without explicit call", () => {
      @XmlRoot("text")
      class TextContent {
        @XmlText()
        text?: string;
      }

      const meta = getMeta(TextContent);
      const textField = meta?.fields.find((f: any) => f.key === "text");
      expect(textField).toBeDefined();
      expect((textField as any).kind).toBe("text");
    });

    it("should work when decorator function is called manually (legacy API)", () => {
      class TestClass {
        textProp?: string;
      }

      const decorator = XmlText();
      const returned = decorator({});

      expect(typeof returned).toBe("function");
      (returned as any)(TestClass.prototype, "textProp");

      const meta = getMeta(TestClass);
      const field = meta?.fields.find((f: any) => f.key === "textProp");
      expect((field as any)?.kind).toBe("text");
    });
  });

  describe("XmlAnyElement", () => {
    it("should handle any element", () => {
      @XmlRoot("flexible")
      class Flexible {
        @XmlAnyElement()
        anyElements?: any[];
      }

      const meta = getMeta(Flexible);
      const anyField = meta?.fields.find((f: any) => f.key === "anyElements");
      expect(anyField).toBeDefined();
      expect((anyField as any).kind).toBe("anyElement");
    });

    it("should mark any element as array", () => {
      @XmlRoot("flexible")
      class Flexible {
        @XmlAnyElement()
        anyElements?: any[];
      }

      const meta = getMeta(Flexible);
      const anyField = meta?.fields.find((f: any) => f.key === "anyElements");
      expect((anyField as any).isArray).toBe(true);
    });

    it("should work when decorator function is called manually (legacy API)", () => {
      class TestClass {
        anyElems?: any[];
      }

      const decorator = XmlAnyElement();
      const returned = decorator({});

      expect(typeof returned).toBe("function");
      (returned as any)(TestClass.prototype, "anyElems");

      const meta = getMeta(TestClass);
      const field = meta?.fields.find((f: any) => f.key === "anyElems");
      expect((field as any)?.kind).toBe("anyElement");
    });
  });

  describe("XmlAnyAttribute", () => {
    it("should handle any attribute", () => {
      @XmlRoot("flexible")
      class Flexible {
        @XmlAnyAttribute()
        anyAttrs?: Record<string, string>;
      }

      const meta = getMeta(Flexible);
      const anyField = meta?.fields.find((f: any) => f.key === "anyAttrs");
      expect(anyField).toBeDefined();
      expect((anyField as any).kind).toBe("anyAttribute");
    });

    it("should store wildcard name for any attribute", () => {
      @XmlRoot("flexible")
      class Flexible {
        @XmlAnyAttribute()
        anyAttrs?: Record<string, string>;
      }

      const meta = getMeta(Flexible);
      const anyField = meta?.fields.find((f: any) => f.key === "anyAttrs");
      expect((anyField as any).name).toBe("*");
    });

    it("should work when decorator function is called manually (legacy API)", () => {
      class TestClass {
        anyAttrs?: Record<string, string>;
      }

      const decorator = XmlAnyAttribute();
      const returned = decorator({});

      expect(typeof returned).toBe("function");
      (returned as any)(TestClass.prototype, "anyAttrs");

      const meta = getMeta(TestClass);
      const field = meta?.fields.find((f: any) => f.key === "anyAttrs");
      expect((field as any)?.kind).toBe("anyAttribute");
    });
  });

  describe("XmlEnum", () => {
    it("should store enum metadata on property with XmlElement", () => {
      @XmlRoot("task")
      class Task {
        @XmlEnum(StatusEnum)
        @XmlElement("status")
        status?: StatusEnum;
      }

      const meta = getMeta(Task);
      expect(meta).toBeDefined();
      const statusField = meta?.fields.find((f: any) => f.key === "status");
      expect(statusField).toBeDefined();
      expect((statusField as any).enumType).toBe(StatusEnum);
    });

    it("should work with attribute fields", () => {
      @XmlRoot("item")
      class Item {
        @XmlEnum(Priority)
        @XmlAttribute("priority")
        priority?: Priority;
      }

      const meta = getMeta(Item);
      const priorityField = meta?.fields.find((f: any) => f.key === "priority");
      expect(priorityField).toBeDefined();
      expect((priorityField as any).enumType).toBe(Priority);
    });

    it("should work with numeric enums", () => {
      @XmlRoot("data")
      class Data {
        @XmlEnum(NumericEnum)
        @XmlElement("value")
        value?: NumericEnum;
      }

      const meta = getMeta(Data);
      const valueField = meta?.fields.find((f: any) => f.key === "value");
      expect(valueField).toBeDefined();
      expect((valueField as any).enumType).toBe(NumericEnum);
    });

    it("should work when decorator function is called manually (legacy API)", () => {
      class TestClass {
        enumProp?: TestEnum;
      }

      const elemDecorator = XmlElement("enumProp");
      const elemReturned = elemDecorator({});
      expect(typeof elemReturned).toBe("function");
      (elemReturned as any)(TestClass.prototype, "enumProp");

      const decorator = XmlEnum(TestEnum);
      const returned = decorator({});

      expect(typeof returned).toBe("function");
      (returned as any)(TestClass.prototype, "enumProp");

      const meta = getMeta(TestClass);
      const field = meta?.fields.find((f: any) => f.key === "enumProp");
      expect((field as any)?.enumType).toBe(TestEnum);
    });

    it("should handle XmlEnum legacy path when field exists", () => {
      @XmlRoot("test")
      class TestClass {
        @XmlElement("propName")
        prop?: TestEnum;
      }

      const enumDecorator = XmlEnum(TestEnum);
      const fn = enumDecorator(TestClass.prototype, "prop");

      expect(fn).toBeUndefined();

      const meta = getMeta(TestClass);
      const field = meta?.fields.find((f: any) => f.key === "prop");
      expect((field as any)?.enumType).toBe(TestEnum);
    });

    it("should work when no existing field metadata present", () => {
      @XmlRoot("test")
      class TestClass {
        @XmlEnum(StatusEnum)
        @XmlElement("status")
        status?: StatusEnum;
      }

      const meta = getMeta(TestClass);
      expect(meta).toBeDefined();
      const statusField = meta?.fields.find((f: any) => f.key === "status");
      expect(statusField).toBeDefined();
    });
  });

  describe("Modern decorator context API", () => {
    it("should handle all decorators with context API", () => {
      @XmlRoot("modern")
      class ModernClass {
        @XmlAttribute("attr")
        attr?: string;

        @XmlElement("elem")
        elem?: string;

        @XmlText()
        text?: string;

        @XmlAnyElement()
        anyElems?: any[];

        @XmlAnyAttribute()
        anyAttrs?: Record<string, string>;
      }

      const meta = getMeta(ModernClass);
      expect(meta).toBeDefined();
      expect(meta?.fields.length).toBeGreaterThan(0);
    });

    it("should support context-based decorator API with XmlEnum", () => {
      @XmlRoot("modern")
      class ModernClass {
        @XmlEnum(StatusEnum)
        @XmlElement("status")
        status?: StatusEnum;
      }

      const meta = getMeta(ModernClass);
      const statusField = meta?.fields.find((f: any) => f.key === "status");
      expect(statusField).toBeDefined();
      expect((statusField as any).enumType).toBe(StatusEnum);
    });
  });

  describe("Roundtrip tests with options", () => {
    it("should marshal and unmarshal with namespaces", () => {
      @XmlRoot("doc", { namespace: "http://example.com/doc" })
      class Document {
        @XmlAttribute("id")
        id?: string;

        @XmlElement("title", { type: String })
        title?: string;
      }

      const doc = new Document();
      doc.id = "123";
      doc.title = "Test Document";

      const xml = marshal(doc);
      expectStringsOnConsecutiveLines(xml, [
        'id="123"',
        "<title>Test Document</title>",
      ]);

      const unmarshalled = unmarshal(Document, xml);
      expect(unmarshalled.id).toBe("123");
      expect(unmarshalled.title).toBe("Test Document");
    });

    it("should handle arrays with types", () => {
      @XmlRoot("numbers")
      class Numbers {
        @XmlElement("value", { type: Number, array: true })
        values?: number[];
      }

      const nums = new Numbers();
      nums.values = [1, 2, 3, 4, 5];

      const xml = marshal(nums);
      const unmarshalled = unmarshal(Numbers, xml);

      expect(unmarshalled.values?.length).toBe(5);
      expect(unmarshalled.values).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("Edge cases", () => {
    it("should handle symbol property keys in legacy path", () => {
      const symbolKey = Symbol("testSymbol");

      class TestClass {
        [symbolKey]?: string;
      }

      const decorator = XmlAttribute("attrName");
      const returned = decorator({});

      expect(typeof returned).toBe("function");
      (returned as any)(TestClass.prototype, symbolKey);

      const meta = getMeta(TestClass);
      expect(meta).toBeDefined();
    });
  });
});
