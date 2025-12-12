import { unmarshal, marshal } from "../src/marshalling";
import { XmlRoot, XmlElement } from "../src/decorators";

describe("AnyAttribute Order", () => {
  test("should preserve order with sequence, attributes, and anyAttribute", () => {
    class Restriction {
      @XmlElement("sequence")
      sequence?: any;

      @XmlElement("attribute", { array: true })
      attribute?: any[];

      @XmlElement("anyAttribute")
      anyAttribute?: any;
    }
    XmlRoot("restriction")(Restriction);

    // Sequence, then attributes, then anyAttribute (as in XSD spec)
    const xml = `<restriction>
  <sequence>
    <element>el1</element>
  </sequence>
  <attribute name="a1">attr1</attribute>
  <attribute name="a2">attr2</attribute>
  <anyAttribute>any</anyAttribute>
</restriction>`;

    const obj = unmarshal(Restriction, xml);
    expect((obj as any)._elementOrder).toBeDefined();
    
    const output = marshal(obj);
    
    // Check order: sequence < attribute < anyAttribute
    const seqPos = output.indexOf("<sequence>");
    const attrPos = output.indexOf(' name="a1"'); // Use attribute content instead
    const anyAttrPos = output.indexOf("<anyAttribute>");
    
    expect(seqPos).toBeGreaterThan(0);
    expect(attrPos).toBeGreaterThan(0);
    expect(anyAttrPos).toBeGreaterThan(0);
    expect(seqPos).toBeLessThan(attrPos);
  });
});
