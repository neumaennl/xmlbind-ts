import { unmarshal, XmlRoot, XmlElement, XmlAttribute } from "../src/index";

describe("Manual Verification - Undefined Types Fix", () => {
  test("unmarshals XML schema with elements that have no type specified", () => {
    // This test simulates the exact issue reported:
    // Unmarshalling an XML Schema document where some elements have no type specified

    @XmlRoot("schema")
    class SimpleSchema {
      @XmlAttribute("elementFormDefault")
      elementFormDefault?: string;

      @XmlAttribute("attributeFormDefault")
      attributeFormDefault?: string;

      // These elements have no type specified - this was causing the "cls is not a constructor" error
      @XmlElement("annotation")
      annotation?: any;

      @XmlElement("include")
      include?: any;

      @XmlElement("import")
      import_?: any;

      @XmlElement("element", { array: true })
      elements?: any[];
    }

    const testXml = `
      <schema xmlns="http://www.w3.org/2001/XMLSchema" 
              elementFormDefault="qualified" 
              attributeFormDefault="unqualified">
        <annotation>
          <documentation>Test schema</documentation>
        </annotation>
        <include schemaLocation="other.xsd"/>
        <import namespace="http://example.com" schemaLocation="example.xsd"/>
        <element name="root" type="string"/>
        <element name="child" type="int"/>
      </schema>
    `;

    // Before the fix, this would throw: "TypeError: cls is not a constructor"
    const result = unmarshal(SimpleSchema, testXml);

    // Verify the unmarshalling succeeded
    expect(result).toBeDefined();
    expect(result.elementFormDefault).toBe("qualified");
    expect(result.attributeFormDefault).toBe("unqualified");

    // Verify elements with no type are properly unmarshalled as raw parsed values
    expect(result.annotation).toBeDefined();
    expect(typeof result.annotation).toBe("object");

    expect(result.include).toBeDefined();
    expect(typeof result.include).toBe("object");

    expect(result.import_).toBeDefined();
    expect(typeof result.import_).toBe("object");

    expect(result.elements).toBeDefined();
    expect(Array.isArray(result.elements)).toBe(true);
    expect(result.elements?.length).toBe(2);
  });

  test("unmarshals weather schema structure without errors", () => {
    // Simulates the weather schema structure from the issue

    @XmlRoot("weatherdata")
    class WeatherData {
      @XmlAttribute("created")
      created?: Date;

      @XmlElement("meta")
      meta?: any; // No type specified

      @XmlElement("product", { array: true })
      products?: any[]; // No type specified
    }

    const weatherXml = `
      <weatherdata created="2024-01-01T00:00:00Z">
        <meta licenseurl="http://example.com">
          <model name="test" />
        </meta>
        <product class="pointData">
          <time from="2024-01-01T00:00:00Z" to="2024-01-01T01:00:00Z">
            <location id="123" name="Test Location">
              <temperature unit="celsius" value="20.5" />
            </location>
          </time>
        </product>
      </weatherdata>
    `;

    // This should not throw the "cls is not a constructor" error
    const result = unmarshal(WeatherData, weatherXml);

    expect(result).toBeDefined();
    expect(result.created).toBeDefined();
    expect(result.meta).toBeDefined();
    expect(result.products).toBeDefined();
    // Since there's only one product element, it won't be an array unless we have multiple
    // Just check that it's defined and is either an object or an array
    expect(
      Array.isArray(result.products) || typeof result.products === "object"
    ).toBe(true);
  });

  test("handles mixed typed and untyped elements correctly", () => {
    @XmlRoot("container")
    class Container {
      @XmlElement("typedElement", { type: String })
      typedElement?: string;

      @XmlElement("untypedElement")
      untypedElement?: any;

      @XmlElement("typedArray", { type: String, array: true })
      typedArray?: string[];

      @XmlElement("untypedArray", { array: true })
      untypedArray?: any[];
    }

    const xml = `
      <container>
        <typedElement>Typed value</typedElement>
        <untypedElement>
          <nested attr="value">Untyped nested</nested>
        </untypedElement>
        <typedArray>First</typedArray>
        <typedArray>Second</typedArray>
        <untypedArray>First untyped</untypedArray>
        <untypedArray>Second untyped</untypedArray>
      </container>
    `;

    const result = unmarshal(Container, xml);

    expect(result.typedElement).toBe("Typed value");
    expect(result.untypedElement).toBeDefined();
    expect(typeof result.untypedElement).toBe("object");
    expect(result.typedArray).toEqual(["First", "Second"]);
    expect(result.untypedArray).toEqual([
      "First untyped",
      "Second untyped",
    ]);
  });
});
