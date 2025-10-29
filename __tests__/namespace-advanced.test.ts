import { marshal, unmarshal } from "../src/marshalling";
import { XmlRoot, XmlElement, XmlAttribute } from "../src/decorators";

@XmlRoot("Child", { namespace: "http://b.example/ns" })
class Child {
  @XmlElement("value", { type: String })
  value?: string;

  // attribute in namespace must be prefixed when marshalled
  @XmlAttribute("code", { namespace: "http://b.example/ns" })
  code?: string;
}

@XmlRoot("Root", { namespace: "http://a.example/ns" })
class Root {
  // child element is from different namespace
  @XmlElement("child", { type: Child, namespace: "http://b.example/ns" })
  child?: Child;
}

describe("Namespace advanced", () => {
  test("multi-namespace with prefixed child element and attribute", () => {
    const child = new Child();
    child.value = "X";
    child.code = "C1";
    const root = new Root();
    root.child = child;

    const xml = marshal(root);
    expect(xml).toContain('<Root xmlns="http://a.example/ns"');
    // Should declare a prefix for the b namespace
    expect(xml).toMatch(/xmlns:ns\d+="http:\/\/b.example\/ns"/);
    // child element should be prefixed because it's in b namespace
    expect(xml).toMatch(/<ns\d+:child\b/);
    // attribute should be prefixed
    expect(xml).toMatch(/ns\d+:code=/);

    const round = unmarshal(Root, xml) as any;
    expect(round.child.value).toBe("X");
    expect(round.child.code).toBe("C1");
  });
});
