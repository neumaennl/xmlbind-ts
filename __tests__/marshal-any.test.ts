import {
  XmlRoot,
  XmlElement,
  XmlAnyElement,
  XmlAnyAttribute,
  marshal,
} from "../src";

test("marshal writes wildcard elements and attributes", () => {
  @XmlRoot("Doc")
  class Doc {
    @XmlElement("known", { type: String })
    known?: string;

    @XmlAnyElement()
    _any?: unknown[];

    @XmlAnyAttribute()
    _anyAttributes?: { [name: string]: string };
  }

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
  // self-close or expanded; check attribute presence and tag name
  expect(xml).toContain("<extra2");
  expect(xml).toContain('attr="y"');
});
