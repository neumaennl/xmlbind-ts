import { XmlAnyAttribute } from "../src/decorators/XmlAnyAttribute";
import { XmlAnyElement } from "../src/decorators/XmlAnyElement";
import { XmlAttribute } from "../src/decorators/XmlAttribute";
import { XmlElement } from "../src/decorators/XmlElement";
import { XmlEnum } from "../src/decorators/XmlEnum";
import { XmlRoot } from "../src/decorators/XmlRoot";
import { XmlText } from "../src/decorators/XmlText";
import { getMeta } from "../src/metadata/MetadataRegistry";

enum TestEnum {
  One = "one",
  Two = "two",
}

describe("Decorator Edge Cases", () => {
  describe("Defensive checks for undefined target", () => {
    it("should handle XmlAnyAttribute with undefined target gracefully", () => {
      const decorator = XmlAnyAttribute();
      // Call with undefined target - should not throw
      expect(() => {
        decorator(undefined, "prop");
      }).not.toThrow();
    });

    it("should handle XmlAnyElement with undefined target gracefully", () => {
      const decorator = XmlAnyElement();
      // Call with undefined target - should not throw
      expect(() => {
        decorator(undefined, "prop");
      }).not.toThrow();
    });

    it("should handle XmlAttribute with undefined target gracefully", () => {
      const decorator = XmlAttribute("name");
      // Call with undefined target - should not throw
      expect(() => {
        decorator(undefined, "prop");
      }).not.toThrow();
    });

    it("should handle XmlElement with undefined target gracefully", () => {
      const decorator = XmlElement("name");
      // Call with undefined target - should not throw
      expect(() => {
        decorator(undefined, "prop");
      }).not.toThrow();
    });

    it("should handle XmlText with undefined target gracefully", () => {
      const decorator = XmlText();
      // Call with undefined target - should not throw
      expect(() => {
        decorator(undefined, "prop");
      }).not.toThrow();
    });

    it("should handle XmlEnum with undefined target gracefully", () => {
      const decorator = XmlEnum(TestEnum);
      // Call with undefined target - should not throw
      expect(() => {
        decorator(undefined, "prop");
      }).not.toThrow();
    });

    it("should handle XmlRoot with undefined target gracefully", () => {
      const decorator = XmlRoot("name");
      // Call with undefined - should not throw
      expect(() => {
        decorator(undefined);
      }).not.toThrow();
    });
  });

  describe("Defensive checks for null target", () => {
    it("should handle XmlAnyAttribute with null target gracefully", () => {
      const decorator = XmlAnyAttribute();
      expect(() => {
        decorator(null, "prop");
      }).not.toThrow();
    });

    it("should handle XmlAnyElement with null target gracefully", () => {
      const decorator = XmlAnyElement();
      expect(() => {
        decorator(null, "prop");
      }).not.toThrow();
    });

    it("should handle XmlAttribute with null target gracefully", () => {
      const decorator = XmlAttribute("name");
      expect(() => {
        decorator(null, "prop");
      }).not.toThrow();
    });

    it("should handle XmlElement with null target gracefully", () => {
      const decorator = XmlElement("name");
      expect(() => {
        decorator(null, "prop");
      }).not.toThrow();
    });

    it("should handle XmlText with null target gracefully", () => {
      const decorator = XmlText();
      expect(() => {
        decorator(null, "prop");
      }).not.toThrow();
    });

    it("should handle XmlEnum with null target gracefully", () => {
      const decorator = XmlEnum(TestEnum);
      expect(() => {
        decorator(null, "prop");
      }).not.toThrow();
    });
  });

  describe("Defensive checks for target without constructor", () => {
    it("should handle XmlAnyAttribute with null-prototype target gracefully", () => {
      const decorator = XmlAnyAttribute();
      const nullProtoTarget = Object.create(null);
      expect(() => {
        decorator(nullProtoTarget, "prop");
      }).not.toThrow();
    });

    it("should handle XmlAnyElement with null-prototype target gracefully", () => {
      const decorator = XmlAnyElement();
      const nullProtoTarget = Object.create(null);
      expect(() => {
        decorator(nullProtoTarget, "prop");
      }).not.toThrow();
    });

    it("should handle XmlAttribute with null-prototype target gracefully", () => {
      const decorator = XmlAttribute("name");
      const nullProtoTarget = Object.create(null);
      expect(() => {
        decorator(nullProtoTarget, "prop");
      }).not.toThrow();
    });

    it("should handle XmlElement with null-prototype target gracefully", () => {
      const decorator = XmlElement("name");
      const nullProtoTarget = Object.create(null);
      expect(() => {
        decorator(nullProtoTarget, "prop");
      }).not.toThrow();
    });

    it("should handle XmlText with null-prototype target gracefully", () => {
      const decorator = XmlText();
      const nullProtoTarget = Object.create(null);
      expect(() => {
        decorator(nullProtoTarget, "prop");
      }).not.toThrow();
    });

    it("should handle XmlEnum with null-prototype target gracefully", () => {
      const decorator = XmlEnum(TestEnum);
      const nullProtoTarget = Object.create(null);
      expect(() => {
        decorator(nullProtoTarget, "prop");
      }).not.toThrow();
    });
  });

  describe("Normal usage still works", () => {
    it("should work correctly with normal class decorators", () => {
      @XmlRoot("Test")
      class TestClass {
        @XmlAttribute("attr")
        attr?: string;

        @XmlElement("elem")
        elem?: string;

        @XmlText()
        text?: string;

        @XmlAnyElement()
        anyElems?: any[];

        @XmlAnyAttribute()
        anyAttrs?: Record<string, string>;

        @XmlEnum(TestEnum)
        @XmlElement("enumField")
        enumField?: TestEnum;
      }

      const meta = getMeta(TestClass);
      expect(meta).toBeDefined();
      expect(meta?.fields.length).toBeGreaterThan(0);

      const attrField = meta?.fields.find((f: any) => f.key === "attr");
      expect(attrField).toBeDefined();
      expect((attrField as any).kind).toBe("attribute");

      const elemField = meta?.fields.find((f: any) => f.key === "elem");
      expect(elemField).toBeDefined();
      expect((elemField as any).kind).toBe("element");

      const textField = meta?.fields.find((f: any) => f.key === "text");
      expect(textField).toBeDefined();
      expect((textField as any).kind).toBe("text");

      const anyElemField = meta?.fields.find((f: any) => f.key === "anyElems");
      expect(anyElemField).toBeDefined();
      expect((anyElemField as any).kind).toBe("anyElement");

      const anyAttrField = meta?.fields.find((f: any) => f.key === "anyAttrs");
      expect(anyAttrField).toBeDefined();
      expect((anyAttrField as any).kind).toBe("anyAttribute");

      const enumField = meta?.fields.find((f: any) => f.key === "enumField");
      expect(enumField).toBeDefined();
      expect((enumField as any).enumType).toBe(TestEnum);
    });
  });
});
