import { XmlRoot, XmlElement, XmlAttribute } from "../src/decorators";
import { marshal, unmarshal } from "../src/marshalling";

@XmlRoot("Person", { namespace: "http://example.com/ns" })
class Person {
  @(XmlAttribute("id") as any)
  id?: number;

  @(XmlElement("name", { type: String }) as any)
  name?: string;

  @(XmlElement("age", { type: Number }) as any)
  age?: number;

  @(XmlElement("aliases", { type: String, array: true }) as any)
  aliases?: string[];
}

const SAMPLE = `<?xml version="1.0"?>\n<Person xmlns="http://example.com/ns" id="42">\n  <name>John Doe</name>\n  <age>30</age>\n  <aliases>J</aliases>\n  <aliases>Johnny</aliases>\n</Person>`;

test("roundtrip person", () => {
  const p = unmarshal(Person, SAMPLE);
  expect(p.name).toBe("John Doe");
  const xml = marshal(p);
  expect(xml).toContain("<name>John Doe</name>");
});
