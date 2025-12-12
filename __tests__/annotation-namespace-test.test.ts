import { unmarshal, marshal } from "../src/marshalling";
import { XmlRoot, XmlElement } from "../src/decorators";

describe("Annotation with Namespace Order", () => {
  test("should preserve order with namespaced elements", () => {
    @XmlRoot("annotation", { namespace: "http://www.w3.org/2001/XMLSchema" })
    class Annotation {
      @XmlElement("appinfo", { array: true, namespace: "http://www.w3.org/2001/XMLSchema" })
      appinfo?: any[];

      @XmlElement("documentation", { array: true, namespace: "http://www.w3.org/2001/XMLSchema" })
      documentation?: any[];
    }

    // With namespace prefix
    const xml = `<xs:annotation xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:appinfo>
    <test>data</test>
  </xs:appinfo>
  <xs:documentation>doc1</xs:documentation>
</xs:annotation>`;

    const obj = unmarshal(Annotation, xml);
    console.log("_elementOrder:", (obj as any)._elementOrder);
    console.log("appinfo:", obj.appinfo);
    console.log("documentation:", obj.documentation);
    
    expect((obj as any)._elementOrder).toBeDefined();
    expect((obj as any)._elementOrder).toEqual(['appinfo', 'documentation']);
    
    const output = marshal(obj);
    console.log("\nMarshalled:");
    console.log(output);
    
    // Check that appinfo comes before documentation
    const appinfoPos = output.indexOf("appinfo");
    const docPos = output.indexOf("documentation");
    
    console.log("appinfoPos:", appinfoPos, "docPos:", docPos);
    
    expect(appinfoPos).toBeGreaterThan(0);
    expect(docPos).toBeGreaterThan(0);
    expect(appinfoPos).toBeLessThan(docPos);
  });
});
