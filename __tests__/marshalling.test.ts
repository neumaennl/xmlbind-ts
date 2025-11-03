import {
  XmlRoot,
  XmlElement,
  XmlAttribute,
  XmlAnyElement,
  XmlAnyAttribute,
  marshal,
  unmarshal,
} from "../src";

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

@XmlRoot("Doc")
class Doc {
  @XmlElement("known", { type: String })
  known?: string;

  @XmlAnyElement()
  _any?: unknown[];

  @XmlAnyAttribute()
  _anyAttributes?: { [name: string]: string };
}

const SAMPLE = `<?xml version="1.0"?>\n<Person xmlns="http://example.com/ns" id="42">\n  <name>John Doe</name>\n  <age>30</age>\n  <alias>J</alias>\n  <alias>Johnny</alias>\n</Person>`;

describe("Marshalling", () => {
  describe("Marshal and unmarshal roundtrips", () => {
    test("roundtrip person and types", () => {
      const p = unmarshal(Person, SAMPLE);

      expect(p).toBeInstanceOf(Person);
      expect(p.name).toBe("John Doe");
      expect(typeof p.name).toBe("string");
      expect(p.age).toBe(30);
      expect(typeof p.age).toBe("number");
      expect(Number(p.id)).toBe(42);
      expect(["number", "string"]).toContain(typeof p.id);

      expect(Array.isArray(p.alias)).toBe(true);
      expect(p.alias).toEqual(["J", "Johnny"]);

      const xml = marshal(p);
      expect(xml).toContain('<Person xmlns="http://example.com/ns"');
      expect(xml).toMatch(/\sid="42"/);
      expect(xml).toContain("<name>John Doe</name>");
      expect(xml).toContain("<age>30</age>");
      expect((xml.match(/<alias>/g) || []).length).toBeGreaterThanOrEqual(2);

      const p2 = unmarshal(Person, xml);
      expect(p2.name).toBe(p.name);
      expect(p2.age).toBe(p.age);
      expect(p2.id).toBe(p.id);
      expect(p2.alias).toEqual(p.alias);
    });
  });

  describe("Marshal with wildcards", () => {
    test("marshal writes wildcard elements and attributes", () => {
      const obj = new Doc();
      obj.known = "ok";
      obj._anyAttributes = { id: "123", customAttr: "x" };
      obj._any = [{ extra1: "v1" }, { extra2: { "@_attr": "y" } }];

      const xml = marshal(obj);
      expect(xml).toContain("<Doc");
      expect(xml).toContain('id="123"');
      expect(xml).toContain('customAttr="x"');
      expect(xml).toContain("<known>ok</known>");
      expect(xml).toContain("<extra1>v1</extra1>");
      expect(xml).toContain("<extra2");
      expect(xml).toContain('attr="y"');
    });
  });

  describe("Unmarshal with wildcards", () => {
    test("unmarshal collects wildcard elements and attributes", () => {
      const xml = `<?xml version="1.0"?>
<Doc id="123" customAttr="x">
  <known>ok</known>
  <extra1>v1</extra1>
  <extra2 attr="y"/>
</Doc>`;

      const obj = unmarshal(Doc, xml);
      expect(obj.known).toBe("ok");
      expect(obj._any && Array.isArray(obj._any)).toBe(true);
      expect((obj._any as any[]).length).toBe(2);
      expect(obj._anyAttributes?.id).toBe("123");
      expect(obj._anyAttributes?.customAttr).toBe("x");
    });
  });
});
