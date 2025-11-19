import { XmlRoot, XmlElement, unmarshal } from "../src/index";

describe("Unmarshal with undefined element type", () => {
  test("should handle elements with no type specified", () => {
    // Define a class with an element that has no type specified
    @XmlRoot("container")
    class Container {
      @XmlElement("dynamicElement")
      dynamicElement?: any;
    }

    const xml = `
      <container>
        <dynamicElement>
          <nested attr="value">Some text</nested>
        </dynamicElement>
      </container>
    `;

    // This should not throw "cls is not a constructor" error
    const result = unmarshal(Container, xml);
    expect(result).toBeDefined();
    expect(result.dynamicElement).toBeDefined();
    // The dynamicElement should contain the raw parsed XML structure
    expect(typeof result.dynamicElement).toBe("object");
  });

  test("should handle array elements with no type specified", () => {
    @XmlRoot("root")
    class Root {
      @XmlElement("item", { array: true })
      items?: any[];
    }

    const xml = `
      <root>
        <item>first</item>
        <item>second</item>
        <item>third</item>
      </root>
    `;

    const result = unmarshal(Root, xml);
    expect(result).toBeDefined();
    expect(result.items).toBeDefined();
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items?.length).toBe(3);
    expect(result.items).toEqual(["first", "second", "third"]);
  });

  test("should handle complex nested structures with no type", () => {
    @XmlRoot("schema")
    class Schema {
      @XmlElement("annotation")
      annotation?: any;

      @XmlElement("element")
      element?: any;
    }

    const xml = `
      <schema>
        <annotation>
          <documentation>This is a doc</documentation>
        </annotation>
        <element name="test" type="string"/>
      </schema>
    `;

    const result = unmarshal(Schema, xml);
    expect(result).toBeDefined();
    expect(result.annotation).toBeDefined();
    expect(result.element).toBeDefined();
  });

  test("should work with XMLSchema.xsd-like structures", () => {
    @XmlRoot("schema")
    class SimpleSchema {
      @XmlElement("include")
      include?: any;

      @XmlElement("import")
      import_?: any;

      @XmlElement("element")
      element?: any;
    }

    const xml = `
      <schema>
        <include schemaLocation="other.xsd"/>
        <import namespace="http://example.com" schemaLocation="example.xsd"/>
        <element name="root" type="string"/>
      </schema>
    `;

    // This is the key test - should not throw "cls is not a constructor"
    expect(() => {
      const result = unmarshal(SimpleSchema, xml);
      expect(result).toBeDefined();
      expect(result.include).toBeDefined();
      expect(result.import_).toBeDefined();
      expect(result.element).toBeDefined();
    }).not.toThrow();
  });
});
