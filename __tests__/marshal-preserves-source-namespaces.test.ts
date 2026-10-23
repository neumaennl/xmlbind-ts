import { marshal, unmarshal } from "../src/marshalling/index.js";
import { XmlRoot, XmlElement, XmlAttribute } from "../src/decorators/index.js";

const XSD_NAMESPACE = "http://www.w3.org/2001/XMLSchema";

@XmlRoot("element", { namespace: XSD_NAMESPACE })
class SchemaElement {
  @XmlAttribute("name", { type: String })
  name?: string;

  @XmlAttribute("type", { type: String })
  type?: string;
}

@XmlRoot("schema", { namespace: XSD_NAMESPACE })
class Schema {
  @XmlAttribute("targetNamespace", { type: String })
  targetNamespace?: string;

  @XmlElement("element", {
    type: SchemaElement,
    array: true,
    namespace: XSD_NAMESPACE,
  })
  elements?: SchemaElement[];
}

describe("marshalling source namespaces", () => {
  test("preserves prefixed names and the source default namespace", () => {
    const input =
      '<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" targetNamespace="urn:t" xmlns="urn:t">' +
      '<xs:element name="person" type="pt"/>' +
      "</xs:schema>";

    const result = marshal(unmarshal(Schema, input));

    expect(result).toContain("<xs:schema");
    expect(result).toContain('xmlns="urn:t"');
    expect(result).toContain('xmlns:xs="http://www.w3.org/2001/XMLSchema"');
    expect(result).toContain('<xs:element name="person" type="pt"');

    const roundTripped = unmarshal(Schema, result);
    expect(roundTripped.targetNamespace).toBe("urn:t");
    expect(roundTripped.elements?.[0]?.type).toBe("pt");
  });
});
