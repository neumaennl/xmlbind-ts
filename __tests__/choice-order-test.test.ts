import { unmarshal } from "../src/marshalling";
import { XmlRoot, XmlElement } from "../src/decorators";

describe("Choice Element Order", () => {
  test("should handle choice between restriction and extension", () => {
    class Restriction {
      @XmlElement("sequence")
      sequence?: any;
    }
    XmlRoot("restriction")(Restriction);
    
    class Extension {
      @XmlElement("group")
      group?: any;
    }
    XmlRoot("extension")(Extension);
    
    // ComplexContent can have EITHER restriction OR extension  
    class ComplexContent {
      @XmlElement("restriction", { type: Restriction })
      restriction?: Restriction;
      
      @XmlElement("extension", { type: Extension })
      extension?: Extension;
    }
    XmlRoot("complexContent")(ComplexContent);
    
    // Test with restriction
    const xmlWithRestriction = `<xs:complexContent xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:restriction>
    <xs:sequence>data</xs:sequence>
  </xs:restriction>
</xs:complexContent>`;

    const obj1 = unmarshal(ComplexContent, xmlWithRestriction);
    console.log("complexContent._elementOrder:", (obj1 as any)._elementOrder);
    console.log("restriction._elementOrder:", (obj1.restriction as any)?._elementOrder);
    
    expect((obj1 as any)._elementOrder).toEqual(['restriction']);
    expect((obj1.restriction as any)?._elementOrder).toEqual(['sequence']);
    
    // Test with extension
    const xmlWithExtension = `<xs:complexContent xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:extension>
    <xs:group>data</xs:group>
  </xs:extension>
</xs:complexContent>`;

    const obj2 = unmarshal(ComplexContent, xmlWithExtension);
    console.log("complexContent._elementOrder (extension case):", (obj2 as any)._elementOrder);
    console.log("extension._elementOrder:", (obj2.extension as any)?._elementOrder);
    
    expect((obj2 as any)._elementOrder).toEqual(['extension']);
    expect((obj2.extension as any)?._elementOrder).toEqual(['group']);
  });
});
