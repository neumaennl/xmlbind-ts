import { XmlRoot, XmlElement, XmlAttribute } from "../src/decorators";
import { marshal, unmarshal } from "../src/marshalling";

@XmlRoot("Person", { namespace: "http://example.com/ns" })
class Person {
  @XmlAttribute("id")
  id?: number;

  @XmlElement("name", { type: String })
  name?: string;

  @XmlElement("age", { type: Number })
  age?: number;

  @XmlElement("alias", { type: String, array: true })
  alias?: string[];
}

const SAMPLE = `<?xml version="1.0"?>\n<Person xmlns="http://example.com/ns" id="42">\n  <name>John Doe</name>\n  <age>30</age>\n  <alias>J</alias>\n  <alias>Johnny</alias>\n</Person>`;

describe("Marshal and Unmarshal", () => {
  test("roundtrip person and types", () => {
    const p = unmarshal(Person, SAMPLE);

    // basic properties and types
    expect(p).toBeInstanceOf(Person);
    expect(p.name).toBe("John Doe");
    expect(typeof p.name).toBe("string");
    expect(p.age).toBe(30);
    expect(typeof p.age).toBe("number");
    // id may be unmarshalled as a string or number depending on implementation
    expect(Number(p.id)).toBe(42);
    expect(["number", "string"]).toContain(typeof p.id);

    // array elements unmarshalled correctly
    expect(Array.isArray(p.alias)).toBe(true);
    expect(p.alias).toEqual(["J", "Johnny"]);

    // marshal back to XML and verify key pieces are present
    const xml = marshal(p);
    expect(xml).toContain('<Person xmlns="http://example.com/ns"');
    expect(xml).toMatch(/\sid="42"/);
    expect(xml).toContain("<name>John Doe</name>");
    expect(xml).toContain("<age>30</age>");
    // both alias entries should be present
    expect((xml.match(/<alias>/g) || []).length).toBeGreaterThanOrEqual(2);

    // roundtrip: unmarshal the marshalled xml and compare
    const p2 = unmarshal(Person, xml);
    expect(p2.name).toBe(p.name);
    expect(p2.age).toBe(p.age);
    expect(p2.id).toBe(p.id);
    expect(p2.alias).toEqual(p.alias);
  });
});
