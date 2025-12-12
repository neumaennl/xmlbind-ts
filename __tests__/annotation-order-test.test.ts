import { unmarshal, marshal } from "../src/marshalling";
import { XmlRoot, XmlElement } from "../src/decorators";

describe("Annotation Element Order", () => {
  test("should preserve order when appinfo comes before documentation", () => {
    class Annotation {
      @XmlElement("appinfo", { array: true })
      appinfo?: string[];

      @XmlElement("documentation", { array: true })
      documentation?: string[];
    }
    XmlRoot("annotation")(Annotation);

    // Multiple appinfo, then documentation
    const xml = `<annotation>
  <appinfo>info1</appinfo>
  <appinfo>info2</appinfo>
  <appinfo>info3</appinfo>
  <documentation>doc1</documentation>
</annotation>`;

    const obj = unmarshal(Annotation, xml);
    
    const output = marshal(obj);
    
    // Check that appinfo comes before documentation
    const appinfoPos = output.indexOf("<appinfo>");
    const docPos = output.indexOf("<documentation>");
    
    expect(appinfoPos).toBeGreaterThan(0);
    expect(docPos).toBeGreaterThan(0);
    expect(appinfoPos).toBeLessThan(docPos);
  });

  test("should preserve order when documentation comes before appinfo", () => {
    class Annotation {
      @XmlElement("appinfo", { array: true })
      appinfo?: string[];

      @XmlElement("documentation", { array: true })
      documentation?: string[];
    }
    XmlRoot("annotation")(Annotation);

    // Documentation first, then appinfo
    const xml = `<annotation>
  <documentation>doc1</documentation>
  <appinfo>info1</appinfo>
  <appinfo>info2</appinfo>
</annotation>`;

    const obj = unmarshal(Annotation, xml);
    
    const output = marshal(obj);
    
    // Check that documentation comes before appinfo
    const appinfoPos = output.indexOf("<appinfo>");
    const docPos = output.indexOf("<documentation>");
    
    expect(appinfoPos).toBeGreaterThan(0);
    expect(docPos).toBeGreaterThan(0);
    expect(docPos).toBeLessThan(appinfoPos);
  });
});
