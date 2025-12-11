import { unmarshal, marshal } from "../src/marshalling";
import { XmlRoot, XmlElement, XmlAttribute } from "../src/decorators";

describe("XSD Extension Element Order", () => {
  test("should preserve order in nested extension with group and attribute", () => {
    // Extension type (like extensionType in XSD)
    @XmlRoot("extension")
    class Extension {
      @XmlAttribute("base")
      base!: string;

      @XmlElement("group")
      group?: string;

      @XmlElement("attribute")
      attribute?: string;
    }

    // ComplexContent type
    @XmlRoot("complexContent")
    class ComplexContent {
      @XmlElement("extension", { type: Extension })
      extension?: Extension;
    }

    // Base class with annotation
    @XmlRoot("annotated")
    class Annotated {
      @XmlElement("annotation")
      annotation?: string;
    }

    // ComplexType that extends Annotated
    @XmlRoot("complexType")
    class ComplexType extends Annotated {
      @XmlElement("complexContent", { type: ComplexContent })
      complexContent?: ComplexContent;
    }

    // Input XML matching XSD restriction element structure
    const xml = `<complexType>
  <annotation>ann text</annotation>
  <complexContent>
    <extension base="xs:annotated">
      <group>group text</group>
      <attribute>attr text</attribute>
    </extension>
  </complexContent>
</complexType>`;

    const obj = unmarshal(ComplexType, xml);
    console.log("complexType._elementOrder:", (obj as any)._elementOrder);
    console.log("complexContent._elementOrder:", (obj.complexContent as any)?._elementOrder);
    console.log("extension._elementOrder:", (obj.complexContent?.extension as any)?._elementOrder);
    
    const output = marshal(obj);
    console.log("\nMarshalled output:");
    console.log(output);
    
    // Check order at complexType level: annotation before complexContent
    const annPos = output.indexOf("<annotation>");
    const ccPos = output.indexOf("<complexContent>");
    expect(annPos).toBeGreaterThan(0);
    expect(ccPos).toBeGreaterThan(0);
    expect(annPos).toBeLessThan(ccPos);

    // Check order at extension level: group before attribute
    const groupPos = output.indexOf("<group>");
    const attrPos = output.indexOf("<attribute>");
    expect(groupPos).toBeGreaterThan(0);
    expect(attrPos).toBeGreaterThan(0);
    expect(groupPos).toBeLessThan(attrPos);
  });
});
