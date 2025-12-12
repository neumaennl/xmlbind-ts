import { unmarshal, marshal } from "../src/marshalling";
import { XmlRoot, XmlElement } from "../src/decorators";

describe("Element Order Preservation", () => {
  test("should preserve element order in unmarshal/marshal roundtrip", () => {
    @XmlRoot("Root")
    class Root {
      @XmlElement("A")
      a?: string;

      @XmlElement("B")
      b?: string;
    }

    // Class definition has A, B order, but XML has B, A order
    const inputXml = `<Root>
  <B>value-b</B>
  <A>value-a</A>
</Root>`;

    const obj = unmarshal(Root, inputXml);
    expect(obj.a).toBe("value-a");
    expect(obj.b).toBe("value-b");

    // Marshal should preserve the B, A order from the input
    const outputXml = marshal(obj);
    
    // Verify B comes before A in the output
    const posB = outputXml.indexOf("<B>");
    const posA = outputXml.indexOf("<A>");
    expect(posB).toBeGreaterThan(0);
    expect(posA).toBeGreaterThan(0);
    expect(posB).toBeLessThan(posA);
  });

  test("should handle elements not in original XML (new properties)", () => {
    @XmlRoot("Root")
    class Root {
      @XmlElement("A")
      a?: string;

      @XmlElement("B")
      b?: string;

      @XmlElement("C")
      c?: string;
    }

    // XML only has B, A (no C)
    const inputXml = `<Root>
  <B>value-b</B>
  <A>value-a</A>
</Root>`;

    const obj = unmarshal(Root, inputXml);
    expect(obj.a).toBe("value-a");
    expect(obj.b).toBe("value-b");
    expect(obj.c).toBeUndefined();

    // Add C after unmarshalling
    obj.c = "value-c";

    // Marshal should preserve B, A order and append C at the end
    const outputXml = marshal(obj);
    
    const posB = outputXml.indexOf("<B>");
    const posA = outputXml.indexOf("<A>");
    const posC = outputXml.indexOf("<C>");
    expect(posB).toBeGreaterThan(0);
    expect(posA).toBeGreaterThan(0);
    expect(posC).toBeGreaterThan(0);
    expect(posB).toBeLessThan(posA);
    expect(posA).toBeLessThan(posC); // C should come after A
  });

  test("should preserve element order in nested objects", () => {
    @XmlRoot("Inner")
    class Inner {
      @XmlElement("X")
      x?: string;

      @XmlElement("Y")
      y?: string;
    }

    @XmlRoot("Outer")
    class Outer {
      @XmlElement("A")
      a?: string;

      @XmlElement("Inner", { type: Inner })
      inner?: Inner;

      @XmlElement("B")
      b?: string;
    }

    // Outer has B, Inner, A order
    // Inner has Y, X order
    const inputXml = `<Outer>
  <B>value-b</B>
  <Inner>
    <Y>value-y</Y>
    <X>value-x</X>
  </Inner>
  <A>value-a</A>
</Outer>`;

    const obj = unmarshal(Outer, inputXml);
    expect(obj.a).toBe("value-a");
    expect(obj.b).toBe("value-b");
    expect(obj.inner?.x).toBe("value-x");
    expect(obj.inner?.y).toBe("value-y");

    const outputXml = marshal(obj);
    
    // Verify outer order: B, Inner, A
    const posB = outputXml.indexOf("<B>");
    const posInner = outputXml.indexOf("<Inner>");
    const posA = outputXml.indexOf("<A>");
    expect(posB).toBeGreaterThan(0);
    expect(posInner).toBeGreaterThan(0);
    expect(posA).toBeGreaterThan(0);
    expect(posB).toBeLessThan(posInner);
    expect(posInner).toBeLessThan(posA);

    // Verify inner order: Y, X
    const posY = outputXml.indexOf("<Y>");
    const posX = outputXml.indexOf("<X>");
    expect(posY).toBeGreaterThan(0);
    expect(posX).toBeGreaterThan(0);
    expect(posY).toBeLessThan(posX);
  });

  test("should work when no element order metadata is present", () => {
    @XmlRoot("Root")
    class Root {
      @XmlElement("A")
      a?: string;

      @XmlElement("B")
      b?: string;
    }

    // Create object directly (not from unmarshalling)
    const obj = new Root();
    obj.a = "value-a";
    obj.b = "value-b";

    // Should marshal in decorator order (A, B) since no _elementOrder exists
    const outputXml = marshal(obj);
    
    const posA = outputXml.indexOf("<A>");
    const posB = outputXml.indexOf("<B>");
    expect(posA).toBeGreaterThan(0);
    expect(posB).toBeGreaterThan(0);
    expect(posA).toBeLessThan(posB);
  });

  test("should preserve order with array elements", () => {
    @XmlRoot("Root")
    class Root {
      @XmlElement("A")
      a?: string;

      @XmlElement("Item", { array: true })
      items?: string[];

      @XmlElement("B")
      b?: string;
    }

    // Order: B, Items (multiple), A
    const inputXml = `<Root>
  <B>value-b</B>
  <Item>item1</Item>
  <Item>item2</Item>
  <A>value-a</A>
</Root>`;

    const obj = unmarshal(Root, inputXml);
    expect(obj.a).toBe("value-a");
    expect(obj.b).toBe("value-b");
    expect(obj.items).toEqual(["item1", "item2"]);

    const outputXml = marshal(obj);
    
    // Verify order: B, Items, A
    const posB = outputXml.indexOf("<B>");
    const posFirstItem = outputXml.indexOf("<Item>");
    const posA = outputXml.indexOf("<A>");
    expect(posB).toBeGreaterThan(0);
    expect(posFirstItem).toBeGreaterThan(0);
    expect(posA).toBeGreaterThan(0);
    expect(posB).toBeLessThan(posFirstItem);
    expect(posFirstItem).toBeLessThan(posA);
  });

  test("should handle mix of defined and undefined elements", () => {
    @XmlRoot("Root")
    class Root {
      @XmlElement("A")
      a?: string;

      @XmlElement("B")
      b?: string;

      @XmlElement("C")
      c?: string;

      @XmlElement("D")
      d?: string;
    }

    // XML has only C, A (B and D are undefined)
    const inputXml = `<Root>
  <C>value-c</C>
  <A>value-a</A>
</Root>`;

    const obj = unmarshal(Root, inputXml);
    expect(obj.a).toBe("value-a");
    expect(obj.b).toBeUndefined();
    expect(obj.c).toBe("value-c");
    expect(obj.d).toBeUndefined();

    const outputXml = marshal(obj);
    
    // Should only have C and A, in that order
    const posC = outputXml.indexOf("<C>");
    const posA = outputXml.indexOf("<A>");
    expect(posC).toBeGreaterThan(0);
    expect(posA).toBeGreaterThan(0);
    expect(posC).toBeLessThan(posA);
    expect(outputXml.indexOf("<B>")).toBe(-1);
    expect(outputXml.indexOf("<D>")).toBe(-1);
  });
});
