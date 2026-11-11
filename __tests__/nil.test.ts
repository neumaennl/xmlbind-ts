import { XmlRoot, XmlElement, marshal, unmarshal } from "../src/index.js";
import { expectStringsOnConsecutiveLines } from "./test-utils/index.js";

const XSI = `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`;

@XmlRoot("Item")
class Item {
  @XmlElement("value", { type: String })
  value?: string;
}

@XmlRoot("Inner")
class Inner {
  @XmlElement("note", { type: String, nillable: true })
  note?: string | null;

  @XmlElement("item", { type: Item, nillable: true })
  item?: Item | null;
}

@XmlRoot("Outer")
class Outer {
  @XmlElement("note", { type: String, nillable: true })
  note?: string | null;

  @XmlElement("item", { type: Item, nillable: true })
  item?: Item | null;

  @XmlElement("entry", { type: String, array: true, nillable: true })
  entry?: (string | null)[];

  @XmlElement("inner", { type: Inner })
  inner?: Inner;
}

describe("xsi:nil", () => {
  describe("Unmarshal", () => {
    test("reads nil child elements of the root as null", () => {
      const outer = unmarshal(Outer, `<Outer ${XSI}><note xsi:nil="true"/><item xsi:nil="true"/></Outer>`);

      expect(outer.note).toBeNull();
      expect(outer.item).toBeNull();
    });

    test("reads nil elements of nested objects as null", () => {
      const outer = unmarshal(
        Outer,
        `<Outer ${XSI}><inner><note xsi:nil="true"/><item xsi:nil="true"/></inner></Outer>`
      );

      expect(outer.inner).toBeInstanceOf(Inner);
      expect(outer.inner?.note).toBeNull();
      expect(outer.inner?.item).toBeNull();
    });

    test("reads nil occurrences of arrays as null entries in their place", () => {
      const outer = unmarshal(Outer, `<Outer ${XSI}><entry>a</entry><entry xsi:nil="true"/><entry>b</entry></Outer>`);

      expect(outer.entry).toEqual(["a", null, "b"]);
    });

    test("does not read xsi:nil=\"false\" as null", () => {
      const outer = unmarshal(Outer, `<Outer ${XSI}><item xsi:nil="false"><value>v</value></item></Outer>`);

      expect(outer.item).toBeInstanceOf(Item);
      expect(outer.item?.value).toBe("v");
    });
  });

  describe("Marshal", () => {
    test("writes null fields as nil elements", () => {
      const outer = unmarshal(Outer, `<Outer ${XSI}/>`);
      outer.note = null;
      outer.item = null;

      const xml = marshal(outer);

      expect(xml).toContain(XSI);
      expectStringsOnConsecutiveLines(xml, ['<note xsi:nil="true"/>', '<item xsi:nil="true"/>']);
    });

    test("keeps nil elements in a round trip", () => {
      const source = `<Outer ${XSI}><note xsi:nil="true"/><inner><item xsi:nil="true"/></inner></Outer>`;

      const outer = unmarshal(Outer, marshal(unmarshal(Outer, source)));

      expect(outer.note).toBeNull();
      expect(outer.inner?.item).toBeNull();
    });
  });
});
