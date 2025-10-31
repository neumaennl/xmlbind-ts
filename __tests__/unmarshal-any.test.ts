import {
  XmlRoot,
  XmlElement,
  XmlAnyElement,
  XmlAnyAttribute,
  unmarshal,
} from "../src";

test("unmarshal collects wildcard elements and attributes", () => {
  @XmlRoot("Doc")
  class Doc {
    @XmlElement("known", { type: String })
    known?: string;

    @XmlAnyElement()
    _any?: unknown[];

    @XmlAnyAttribute()
    _anyAttributes?: { [name: string]: string };
  }

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
