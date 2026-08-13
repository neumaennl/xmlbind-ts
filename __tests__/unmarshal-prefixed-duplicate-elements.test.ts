/**
 * Tests for unmarshal correctly handling prefixed duplicate element occurrences
 * when unprefixed and prefixed keys share the same local name and namespace.
 * See: https://github.com/neumaennl/xmlbind-ts/issues/216
 */

import { unmarshal } from "../src/marshalling/index.ts";
import { XmlRoot, XmlElement, XmlAttribute } from "../src/decorators/index.ts";

const XS_NS = "http://www.w3.org/2001/XMLSchema";

@XmlRoot("simpleType", { namespace: XS_NS })
class SimpleType {
  @XmlAttribute("name")
  name?: string;
}

@XmlRoot("complexType", { namespace: XS_NS })
class ComplexType {
  @XmlAttribute("name")
  name?: string;
}

@XmlRoot("element", { namespace: XS_NS })
class XsElement {
  @XmlAttribute("name")
  name?: string;
}

@XmlRoot("schema", { namespace: XS_NS })
class Schema {
  @XmlElement("simpleType", { type: SimpleType, array: true, namespace: XS_NS })
  simpleType?: SimpleType[];

  @XmlElement("complexType", { type: ComplexType, array: true, namespace: XS_NS })
  complexType?: ComplexType[];

  @XmlElement("element", { type: XsElement, array: true, namespace: XS_NS })
  element?: XsElement[];
}

describe("unmarshal prefixed duplicate element occurrences", () => {
  test("merges unprefixed and prefixed simpleType entries into one array", () => {
    const xml = `
<schema xmlns="http://www.w3.org/2001/XMLSchema" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <simpleType name="unprefixedType">
    <restriction base="xs:string" />
  </simpleType>
  <xs:simpleType name="prefixedType">
    <xs:restriction base="xs:string" />
  </xs:simpleType>
</schema>`;

    const result = unmarshal(Schema, xml);
    expect(result.simpleType).toBeDefined();
    const names = result.simpleType!.map((item) => item.name);
    expect(names).toContain("unprefixedType");
    expect(names).toContain("prefixedType");
    expect(names).toHaveLength(2);
  });

  test("merges multiple unprefixed and prefixed simpleType entries", () => {
    const xml = `
<schema xmlns="http://www.w3.org/2001/XMLSchema" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <simpleType name="a" />
  <xs:simpleType name="b" />
  <simpleType name="c" />
  <xs:simpleType name="d" />
</schema>`;

    const result = unmarshal(Schema, xml);
    expect(result.simpleType).toBeDefined();
    const names = result.simpleType!.map((item) => item.name);
    expect(names).toHaveLength(4);
    expect(names).toContain("a");
    expect(names).toContain("b");
    expect(names).toContain("c");
    expect(names).toContain("d");
  });

  test("merges unprefixed and prefixed complexType entries", () => {
    const xml = `
<schema xmlns="http://www.w3.org/2001/XMLSchema" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <complexType name="unprefixedComplex" />
  <xs:complexType name="prefixedComplex" />
</schema>`;

    const result = unmarshal(Schema, xml);
    expect(result.complexType).toBeDefined();
    const names = result.complexType!.map((item) => item.name);
    expect(names).toContain("unprefixedComplex");
    expect(names).toContain("prefixedComplex");
    expect(names).toHaveLength(2);
  });

  test("merges unprefixed and prefixed element entries", () => {
    const xml = `
<schema xmlns="http://www.w3.org/2001/XMLSchema" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <element name="unprefixedElem" type="xs:string" />
  <xs:element name="prefixedElem" type="xs:string" />
</schema>`;

    const result = unmarshal(Schema, xml);
    expect(result.element).toBeDefined();
    const names = result.element!.map((item) => item.name);
    expect(names).toContain("unprefixedElem");
    expect(names).toContain("prefixedElem");
    expect(names).toHaveLength(2);
  });

  test("handles only unprefixed elements (no regression)", () => {
    const xml = `
<schema xmlns="http://www.w3.org/2001/XMLSchema">
  <simpleType name="typeA" />
  <simpleType name="typeB" />
</schema>`;

    const result = unmarshal(Schema, xml);
    expect(result.simpleType).toBeDefined();
    const names = result.simpleType!.map((item) => item.name);
    expect(names).toEqual(["typeA", "typeB"]);
  });

  test("handles only prefixed elements (no regression)", () => {
    const xml = `
<schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:simpleType name="typeX" />
  <xs:simpleType name="typeY" />
</schema>`;

    const result = unmarshal(Schema, xml);
    expect(result.simpleType).toBeDefined();
    const names = result.simpleType!.map((item) => item.name);
    expect(names).toEqual(["typeX", "typeY"]);
  });
});

// Test the same fix for nested (non-root) element binding
@XmlRoot("Item", { namespace: "http://example.com/ns" })
class ItemClass {
  @XmlAttribute("id")
  id?: string;
}

@XmlRoot("Parent", { namespace: "http://example.com/ns" })
class Parent {
  @XmlElement("Item", { type: ItemClass, array: true, namespace: "http://example.com/ns" })
  item?: ItemClass[];
}

describe("unmarshal prefixed duplicate elements in nested context", () => {
  test("merges unprefixed and prefixed nested element occurrences", () => {
    const xml = `
<Parent xmlns="http://example.com/ns" xmlns:ns="http://example.com/ns">
  <Item id="1" />
  <ns:Item id="2" />
  <Item id="3" />
</Parent>`;

    const result = unmarshal(Parent, xml);
    expect(result.item).toBeDefined();
    const ids = result.item!.map((item) => item.id);
    expect(ids).toHaveLength(3);
    expect(ids).toContain("1");
    expect(ids).toContain("2");
    expect(ids).toContain("3");
  });
});
