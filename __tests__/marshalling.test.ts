import {
  XmlRoot,
  XmlElement,
  XmlAttribute,
  XmlAnyElement,
  XmlAnyAttribute,
  XmlText,
  marshal,
  unmarshal,
} from "../src/index.js";
import { expectStringsOnConsecutiveLines, expectStringsOnSameLine, firstLine } from "./test-utils/index.js";

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

@XmlRoot("Pair")
class Pair {
  @XmlElement("a", { type: String })
  a?: string;

  @XmlElement("b", { type: String })
  b?: string;

  @XmlAnyElement()
  _any?: unknown[];
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
      // Verify that the XML has the XML declaration since the input had one
      expect(xml).toContain('<?xml version="1.0"');
      
      // Verify that attributes appear on the same line as the opening tag
      const lines = xml.split('\n');
      const personLine = lines.find((l: string) => l.includes('<Person'));
      expect(personLine).toBeDefined();
      expectStringsOnSameLine(personLine!, [
        '<Person xmlns="http://example.com/ns"',
        'id="42"',
      ]);
      // Verify elements appear on consecutive lines
      expectStringsOnConsecutiveLines(xml, [
        "<name>John Doe</name>",
        "<age>30</age>",
      ]);
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
      // Verify that attributes appear on the same line as the opening tag
      const rootLine = firstLine(xml);
      expectStringsOnSameLine(rootLine, [
        "<Doc",
        'id="123"',
        'customAttr="x"',
      ]);
      // Verify elements appear on consecutive lines, and attr="y" is on the extra2 line
      expectStringsOnConsecutiveLines(xml, [
        "<known>ok</known>",
        "<extra1>v1</extra1>",
        "<extra2",
      ]);
      // Find the line with extra2 and verify it has attr="y"
      const extra2Line = xml.split("\n").find((line: string) => line.includes("<extra2"));
      expect(extra2Line).toContain('attr="y"');
    });
  });

  describe("Marshal wildcards with special names", () => {
    test("writes a wildcard element with the name of a mapped element after the mapped elements", () => {
      const pair = Object.assign(new Pair(), { a: "x", b: "y", _any: [{ a: "w" }] });

      expectStringsOnConsecutiveLines(marshal(pair), ["<a>x</a>", "<b>y</b>", "<a>w</a>"]);
    });

    test.each(["@_x", "#text"])(
      "throws for a wildcard element named %j, which marks an attribute or text in the keyed format",
      (name) => {
        const pair = Object.assign(new Pair(), { _any: [{ [name]: "v" }] });

        expect(() => marshal(pair)).toThrow(/cannot be named/);
      }
    );
  });

  describe("Marshal arrays", () => {
    test("writes null entries as empty elements in their place", () => {
      const person = new Person();
      person.alias = ["J", null as unknown as string, "Johnny"];

      expectStringsOnConsecutiveLines(marshal(person), [
        "<alias>J</alias>",
        "<alias/>",
        "<alias>Johnny</alias>",
      ]);
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

  describe("Text content of the root", () => {
    test("unmarshal reads the text of a root with attributes into the text field", () => {
      @XmlRoot("Note")
      class Note {
        @XmlAttribute("lang")
        lang?: string;

        @XmlText()
        text?: string;
      }

      const note = unmarshal(Note, `<Note lang="en">Hello</Note>`);

      expect(note.lang).toBe("en");
      expect(note.text).toBe("Hello");
    });
  });

  describe("Unmarshal elements with unmapped attributes", () => {
    test("reads the text of an element with attributes into a primitive field", () => {
      const person = unmarshal(Person, `<Person xmlns="http://example.com/ns"><age unit="years">30</age></Person>`);

      expect(person.age).toBe(30);
    });
  });

  describe("Errors", () => {
    class Undecorated {
      name?: string;
    }

    test("unmarshal rejects a class without @XmlRoot", () => {
      expect(() => unmarshal(Undecorated, "<Undecorated/>")).toThrow("No XmlRoot metadata for Undecorated");
    });

    test("unmarshal rejects a document without the root element", () => {
      expect(() => unmarshal(Pair, "<Other/>")).toThrow("Root element Pair not found");
    });

    test("marshal rejects an object without @XmlRoot", () => {
      expect(() => marshal(new Undecorated())).toThrow("No XmlRoot metadata for Undecorated");
    });

    test("marshal returns an empty string for null and undefined", () => {
      expect(marshal(null)).toBe("");
      expect(marshal(undefined)).toBe("");
    });
  });

  describe("Pretty-printing", () => {
    test("marshal produces pretty-printed XML with proper indentation", () => {
      const person = new Person();
      person.id = 42;
      person.name = "John Doe";
      person.age = 30;
      person.alias = ["J", "Johnny"];

      const xml = marshal(person);

      // Verify the XML is pretty-printed with newlines
      expect(xml.includes("\n")).toBe(true);

      // Verify proper indentation (child elements should be indented)
      expect(xml).toContain("  <name>");
      expect(xml).toContain("  <age>");
      expect(xml).toContain("  <alias>");

      // Verify structure: opening tag on one line, child elements indented, closing tag on separate line
      const lines = xml.split("\n").filter((line: string) => line.trim() !== "");
      expect(lines.length).toBeGreaterThan(3);
      expect(lines[0]).toContain("<Person");
      expect(lines[lines.length - 1]).toBe("</Person>");
    });

    test("pretty-printed XML can be unmarshalled correctly", () => {
      const person = new Person();
      person.id = 99;
      person.name = "Jane Smith";
      person.age = 25;

      const xml = marshal(person);
      const unmarshalled = unmarshal(Person, xml);

      expect(Number(unmarshalled.id)).toBe(person.id);
      expect(unmarshalled.name).toBe(person.name);
      expect(unmarshalled.age).toBe(person.age);
    });
  });
});
