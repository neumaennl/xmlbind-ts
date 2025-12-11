import { unmarshal, marshal } from "../src/marshalling";
import { XmlRoot, XmlElement } from "../src/decorators";

describe("XSD Restriction Element Order", () => {
  test("should preserve order with inherited annotation field", () => {
    // Base class with annotation (like annotated)
    @XmlRoot("annotated")
    class Annotated {
      @XmlElement("annotation")
      annotation?: string;
    }

    // Derived class with complexContent (like complexType)
    @XmlRoot("complexType")
    class ComplexType extends Annotated {
      @XmlElement("complexContent")
      complexContent?: string;
    }

    // Input XML has annotation BEFORE complexContent
    const xml = `<complexType>
  <annotation>ann text</annotation>
  <complexContent>cc text</complexContent>
</complexType>`;

    const obj = unmarshal(ComplexType, xml);
    console.log("_elementOrder:", (obj as any)._elementOrder);
    
    const output = marshal(obj);
    console.log("Marshalled:", output);
    
    // Check order
    const annPos = output.indexOf("<annotation>");
    const ccPos = output.indexOf("<complexContent>");
    
    expect(annPos).toBeGreaterThan(0);
    expect(ccPos).toBeGreaterThan(0);
    expect(annPos).toBeLessThan(ccPos);
  });
});
