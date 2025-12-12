import { unmarshal, marshal } from "../src/marshalling";
import { XmlRoot, XmlElement, XmlAttribute } from "../src/decorators";

describe("XSD Array Element Order", () => {
  test("should preserve order with array elements", () => {
    @XmlRoot("extension")
    class Extension {
      @XmlAttribute("base")
      base!: string;

      @XmlElement("group")
      group?: string;

      @XmlElement("attribute", { array: true })
      attribute?: string[];
    }

    // Input XML: group, then multiple attributes
    const xml = `<extension base="xs:annotated">
  <group>group text</group>
  <attribute>attr1</attribute>
  <attribute>attr2</attribute>
</extension>`;

    const obj = unmarshal(Extension, xml);
    
    const output = marshal(obj);
    
    // Check order: group before attribute
    const groupPos = output.indexOf("<group>");
    const attrPos = output.indexOf("<attribute>");
    expect(groupPos).toBeGreaterThan(0);
    expect(attrPos).toBeGreaterThan(0);
    expect(groupPos).toBeLessThan(attrPos);
  });
});
