import { unmarshal, marshal } from "../src/marshalling";
import { XmlRoot, XmlElement, XmlAttribute } from "../src/decorators";

describe("Restriction with Nested ComplexContent", () => {
  test("should preserve order in complexContent > restriction > sequence/attributes", () => {
    // Simulating XSD structure: element > complexType > complexContent > restriction
    
    class Restriction {
      @XmlAttribute("base")
      base?: string;
      
      @XmlElement("sequence")
      sequence?: any;
      
      @XmlElement("attribute", { array: true })
      attribute?: any[];
      
      @XmlElement("anyAttribute")
      anyAttribute?: any;
    }
    XmlRoot("restriction")(Restriction);
    
    class ComplexContent {
      @XmlElement("restriction", { type: Restriction })
      restriction?: Restriction;
    }
    XmlRoot("complexContent")(ComplexContent);
    
    class ComplexType {
      @XmlElement("complexContent", { type: ComplexContent })
      complexContent?: ComplexContent;
    }
    XmlRoot("complexType")(ComplexType);
    
    // XML with proper XSD order: sequence, attributes, anyAttribute
    const xml = `<xs:complexType xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:complexContent>
    <xs:restriction base="xs:someType">
      <xs:sequence>
        <xs:element ref="xs:annotation"/>
      </xs:sequence>
      <xs:attribute name="attr1"/>
      <xs:attribute name="attr2"/>
      <xs:anyAttribute namespace="##other"/>
    </xs:restriction>
  </xs:complexContent>
</xs:complexType>`;

    const obj = unmarshal(ComplexType, xml);
    
    // Verify nested element orders are being captured
    expect((obj as any)._elementOrder).toEqual(['complexContent']);
    expect((obj.complexContent as any)?._elementOrder).toEqual(['restriction']);
    expect((obj.complexContent?.restriction as any)?._elementOrder).toEqual(['sequence', 'attribute', 'attribute', 'anyAttribute']);
    
    const output = marshal(obj);
    
    // Verify order is preserved
    const seqPos = output.indexOf("<sequence>");
    const attr1Pos = output.indexOf('name="attr1"');
    const anyAttrPos = output.indexOf("<anyAttribute");
    
    expect(seqPos).toBeGreaterThan(0);
    expect(attr1Pos).toBeGreaterThan(0);
    expect(anyAttrPos).toBeGreaterThan(0);
    expect(seqPos).toBeLessThan(attr1Pos);
    expect(attr1Pos).toBeLessThan(anyAttrPos);
  });
});
