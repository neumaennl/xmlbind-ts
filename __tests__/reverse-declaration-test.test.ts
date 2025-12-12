import { unmarshal, marshal } from "../src/marshalling";
import { XmlRoot, XmlElement } from "../src/decorators";

describe("Reverse Declaration Order", () => {
  test("should preserve XML order even when decorators are in reverse order", () => {
    class Restriction {
      // Decorators in REVERSE order from typical XSD
      @XmlElement("anyAttribute")
      anyAttribute?: any;

      @XmlElement("attribute", { array: true })
      attribute?: any[];

      @XmlElement("sequence")
      sequence?: any;
    }
    XmlRoot("restriction")(Restriction);

    // XML in proper XSD order: sequence, attributes, anyAttribute
    const xml = `<restriction>
  <sequence>
    <element>el1</element>
  </sequence>
  <attribute name="a1">attr1</attribute>
  <attribute name="a2">attr2</attribute>
  <anyAttribute>any</anyAttribute>
</restriction>`;

    const obj = unmarshal(Restriction, xml);
    
    const output = marshal(obj);
    
    // Should still preserve XML order: sequence first, anyAttribute last
    const seqPos = output.indexOf("<sequence>");
    const anyAttrPos = output.indexOf("<anyAttribute>");
    
    expect(seqPos).toBeGreaterThan(0);
    expect(anyAttrPos).toBeGreaterThan(0);
    expect(seqPos).toBeLessThan(anyAttrPos);
  });
});
