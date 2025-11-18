import { XmlRoot, XmlElement, XmlAnyAttribute, marshal, getMeta } from "../src";

// Define classes at module level to avoid scoping issues
@XmlRoot("Document")
class Document {
  @XmlElement("title")
  title?: string;

  @XmlAnyAttribute()
  additionalAttributes?: { [name: string]: string };
}

@XmlRoot("TestClass")
class TestClass {
  @XmlAnyAttribute()
  anyAttrs?: { [name: string]: string };
}

@XmlRoot("Complex")
class Complex {
  @XmlElement("name")
  name?: string;

  @XmlElement("value", { type: Number })
  value?: number;

  @XmlAnyAttribute()
  extraAttrs?: { [name: string]: string };
}

describe("XmlAnyAttribute Integration Tests", () => {
  test("should marshal with anyAttribute", () => {
    const doc = new Document();
    doc.title = "Test Document";
    doc.additionalAttributes = { id: "123", version: "1.0", author: "John" };

    const xml = marshal(doc);
    expect(xml).toContain("<Document");
    expect(xml).toContain('id="123"');
    expect(xml).toContain('version="1.0"');
    expect(xml).toContain('author="John"');
    expect(xml).toContain("<title>Test Document</title>");
  });

  test("should create instance without errors", () => {
    // This should not throw "Cannot read properties of undefined (reading 'constructor')"
    expect(() => {
      const instance = new TestClass();
      instance.anyAttrs = { test: "value" };
    }).not.toThrow();
    
    const instance = new TestClass();
    instance.anyAttrs = { test: "value" };
    expect(instance.anyAttrs).toEqual({ test: "value" });
  });

  test("should register metadata correctly", () => {
    const meta = getMeta(TestClass);
    expect(meta).toBeDefined();
    
    const anyAttrField = meta?.fields.find((f: any) => f.key === "anyAttrs");
    expect(anyAttrField).toBeDefined();
    expect((anyAttrField as any).kind).toBe("anyAttribute");
    expect((anyAttrField as any).name).toBe("*");
  });

  test("should work with multiple decorators in marshalling", () => {
    const obj = new Complex();
    obj.name = "Test";
    obj.value = 42;
    obj.extraAttrs = { id: "100", type: "special" };

    const xml = marshal(obj);
    expect(xml).toContain('id="100"');
    expect(xml).toContain('type="special"');
    expect(xml).toContain("<name>Test</name>");
    expect(xml).toContain("<value>42</value>");
  });
  
  test("should handle marshal with no extra attributes", () => {
    const obj = new Complex();
    obj.name = "Test";
    obj.value = 42;
    // extraAttrs is undefined

    const xml = marshal(obj);
    expect(xml).toContain("<Complex");
    expect(xml).toContain("<name>Test</name>");
    expect(xml).toContain("<value>42</value>");
  });
});
