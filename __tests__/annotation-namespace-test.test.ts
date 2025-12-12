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
    
    expect((obj as any)._elementOrder).toBeDefined();
    expect((obj as any)._elementOrder).toEqual(['appinfo', 'documentation']);
    
    const output = marshal(obj);
    
    // Check that appinfo comes before documentation
    const appinfoPos = output.indexOf("appinfo");
    const docPos = output.indexOf("documentation");
    
    expect(appinfoPos).toBeGreaterThan(0);
    expect(docPos).toBeGreaterThan(0);
    expect(appinfoPos).toBeLessThan(docPos);
  });
});
