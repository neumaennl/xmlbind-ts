import { marshal, unmarshal } from "../src/marshalling";
import { XmlRoot, XmlElement, XmlAttribute } from "../src/decorators";
import { expectStringsOnSameLine } from "./test-utils";

afterEach(() => {
  // no-op, placeholder in case of future cleanup
});

@XmlRoot("Child", {
  namespace: "http://b.example/ns",
  prefixes: { "http://b.example/ns": "b" },
})
class Child {
  @XmlElement("value", { type: String })
  value?: string;

  @XmlAttribute("code", { namespace: "http://b.example/ns" })
  code?: string;
}

@XmlRoot("Root", {
  namespace: "http://a.example/ns",
  prefixes: { "http://a.example/ns": "a", "http://b.example/ns": "b" },
})
class Root {
  @XmlElement("child", { type: Child, namespace: "http://b.example/ns" })
  child?: Child;
}

describe("namespace prefixes honoring schema-defined names", () => {
  test("marshaller uses provided prefixes (a,b)", () => {
    const c = new Child();
    c.value = "X";
    c.code = "C1";
    const r = new Root();
    r.child = c;

    const xml = marshal(r);
    // Verify that namespace attributes appear on the same line as the opening tag
    const firstLine = xml.split('\n')[0];
    expectStringsOnSameLine(firstLine, [
      '<Root xmlns="http://a.example/ns"',
      'xmlns:b="http://b.example/ns"',
    ]);
    expect(xml).toMatch(/<b:child\b/);
    expect(xml).toMatch(/b:code=/);

    const back = unmarshal(Root, xml) as any;
    expect(back.child.value).toBe("X");
    expect(back.child.code).toBe("C1");
  });
});
