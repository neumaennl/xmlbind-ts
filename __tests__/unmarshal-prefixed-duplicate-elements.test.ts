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

@XmlRoot("attribute", { namespace: XS_NS })
class XsAttribute {
  @XmlAttribute("name")
  name?: string;
}

@XmlRoot("attributeGroup", { namespace: XS_NS })
class AttributeGroup {
  @XmlAttribute("name")
  name?: string;
}

@XmlRoot("group", { namespace: XS_NS })
class Group {
  @XmlAttribute("name")
  name?: string;
}

@XmlRoot("notation", { namespace: XS_NS })
class Notation {
  @XmlAttribute("name")
  name?: string;
}

@XmlRoot("annotation", { namespace: XS_NS })
class Annotation {
  @XmlAttribute("id")
  id?: string;
}

@XmlRoot("schema", { namespace: XS_NS })
class Schema {
  @XmlElement("simpleType", { type: SimpleType, array: true, namespace: XS_NS })
  simpleType?: SimpleType[];

  @XmlElement("complexType", { type: ComplexType, array: true, namespace: XS_NS })
  complexType?: ComplexType[];

  @XmlElement("element", { type: XsElement, array: true, namespace: XS_NS })
  element?: XsElement[];

  @XmlElement("attribute", { type: XsAttribute, array: true, namespace: XS_NS })
  attribute?: XsAttribute[];

  @XmlElement("attributeGroup", { type: AttributeGroup, array: true, namespace: XS_NS })
  attributeGroup?: AttributeGroup[];

  @XmlElement("group", { type: Group, array: true, namespace: XS_NS })
  group?: Group[];

  @XmlElement("notation", { type: Notation, array: true, namespace: XS_NS })
  notation?: Notation[];

  @XmlElement("annotation", { type: Annotation, array: true, namespace: XS_NS })
  annotation?: Annotation[];
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
    // mergeElementsByDocumentOrder uses the preserve-order tree to recover true
    // document order even when fast-xml-parser groups by key internally.
    expect(names).toEqual(["a", "b", "c", "d"]);
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

  test("merges unprefixed and prefixed attribute entries", () => {
    const xml = `
<schema xmlns="http://www.w3.org/2001/XMLSchema" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <attribute name="unprefixedAttr" type="xs:string" />
  <xs:attribute name="prefixedAttr" type="xs:string" />
</schema>`;

    const result = unmarshal(Schema, xml);
    expect(result.attribute).toBeDefined();
    const names = result.attribute!.map((item) => item.name);
    expect(names).toContain("unprefixedAttr");
    expect(names).toContain("prefixedAttr");
    expect(names).toHaveLength(2);
  });

  test("merges unprefixed and prefixed attributeGroup entries", () => {
    const xml = `
<schema xmlns="http://www.w3.org/2001/XMLSchema" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <attributeGroup name="unprefixedGroup" />
  <xs:attributeGroup name="prefixedGroup" />
</schema>`;

    const result = unmarshal(Schema, xml);
    expect(result.attributeGroup).toBeDefined();
    const names = result.attributeGroup!.map((item) => item.name);
    expect(names).toContain("unprefixedGroup");
    expect(names).toContain("prefixedGroup");
    expect(names).toHaveLength(2);
  });

  test("merges unprefixed and prefixed group entries", () => {
    const xml = `
<schema xmlns="http://www.w3.org/2001/XMLSchema" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <group name="unprefixedGroup" />
  <xs:group name="prefixedGroup" />
</schema>`;

    const result = unmarshal(Schema, xml);
    expect(result.group).toBeDefined();
    const names = result.group!.map((item) => item.name);
    expect(names).toContain("unprefixedGroup");
    expect(names).toContain("prefixedGroup");
    expect(names).toHaveLength(2);
  });

  test("merges unprefixed and prefixed notation entries", () => {
    const xml = `
<schema xmlns="http://www.w3.org/2001/XMLSchema" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <notation name="unprefixedNotation" public="text/html" />
  <xs:notation name="prefixedNotation" public="text/xml" />
</schema>`;

    const result = unmarshal(Schema, xml);
    expect(result.notation).toBeDefined();
    const names = result.notation!.map((item) => item.name);
    expect(names).toContain("unprefixedNotation");
    expect(names).toContain("prefixedNotation");
    expect(names).toHaveLength(2);
  });

  test("merges unprefixed and prefixed annotation entries", () => {
    const xml = `
<schema xmlns="http://www.w3.org/2001/XMLSchema" xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <annotation id="ann1" />
  <xs:annotation id="ann2" />
</schema>`;

    const result = unmarshal(Schema, xml);
    expect(result.annotation).toBeDefined();
    const ids = result.annotation!.map((item) => item.id);
    expect(ids).toContain("ann1");
    expect(ids).toContain("ann2");
    expect(ids).toHaveLength(2);
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
    expect(ids).toEqual(["1", "2", "3"]);
  });
});
