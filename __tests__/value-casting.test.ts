import { castValue, serializePrimitive } from "../src/util/valueCasting";

enum TestEnum {
  ValueOne = "one",
  ValueTwo = "two",
  ValueThree = "three",
}

enum NumericEnum {
  First = 1,
  Second = 2,
  Third = 3,
}

describe("valueCasting", () => {
  describe("castValue", () => {
    it("should return null or undefined as-is", () => {
      expect(castValue(null)).toBeNull();
      expect(castValue(undefined)).toBeUndefined();
      expect(castValue(null, String)).toBeNull();
      expect(castValue(undefined, Number)).toBeUndefined();
    });

    it("should return value unchanged when no type specified", () => {
      expect(castValue("test")).toBe("test");
      expect(castValue(123)).toBe(123);
      expect(castValue(true)).toBe(true);
    });

    it("should cast to String", () => {
      expect(castValue(123, String)).toBe("123");
      expect(castValue(true, String)).toBe("true");
      expect(castValue(null, String)).toBeNull();
    });

    it("should cast to Number", () => {
      expect(castValue("123", Number)).toBe(123);
      expect(castValue("45.67", Number)).toBe(45.67);
      expect(castValue(true, Number)).toBe(1);
      expect(castValue(false, Number)).toBe(0);
    });

    it("should cast to Boolean", () => {
      expect(castValue("true", Boolean)).toBe(true);
      expect(castValue("false", Boolean)).toBe(false);
      expect(castValue(true, Boolean)).toBe(true);
      expect(castValue(false, Boolean)).toBe(false);
      expect(castValue("anything", Boolean)).toBe(false);
      expect(castValue("", Boolean)).toBe(false);
    });

    it("should cast to Date", () => {
      const dateStr = "2023-10-15T12:00:00.000Z";
      const result = castValue(dateStr, Date);
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe(dateStr);

      const timestamp = 1697371200000;
      const result2 = castValue(timestamp, Date);
      expect(result2).toBeInstanceOf(Date);
    });

    describe("Enum handling", () => {
      it("should return enum value if it exists in enum", () => {
        expect(castValue("one", TestEnum)).toBe("one");
        expect(castValue("two", TestEnum)).toBe("two");
        expect(castValue("three", TestEnum)).toBe("three");
      });

      it("should return enum value from key", () => {
        expect(castValue("ValueOne", TestEnum)).toBe("one");
        expect(castValue("ValueTwo", TestEnum)).toBe("two");
        expect(castValue("ValueThree", TestEnum)).toBe("three");
      });

      it("should handle numeric enums", () => {
        expect(castValue(1, NumericEnum)).toBe(1);
        expect(castValue(2, NumericEnum)).toBe(2);
        expect(castValue(3, NumericEnum)).toBe(3);
      });

      it("should return value if it's a string key in numeric enum", () => {
        // For numeric enums, string keys like "First" are checked with "in"
        // but the enumValues.includes() check happens first, and "First" is not in values
        // So it checks if "First" in NumericEnum which is true, but then returns NumericEnum["First"]
        // However, "First" is a value in the enum (as the reverse mapping), so it gets returned as-is
        const result = castValue("First", NumericEnum);
        // "First" is actually a value in the enum due to reverse mapping, so it returns "First"
        expect(result).toBe("First");
      });

      it("should return original value if not found in enum", () => {
        expect(castValue("invalid", TestEnum)).toBe("invalid");
        expect(castValue(999, NumericEnum)).toBe(999);
      });
    });

    it("should handle array type (not cast array)", () => {
      const arr = [1, 2, 3];
      expect(castValue(arr, Array)).toBe(arr);
    });

    it("should handle custom objects", () => {
      const obj = { foo: "bar" };
      expect(castValue(obj, Object)).toBe(obj);
    });
  });

  describe("serializePrimitive", () => {
    it("should serialize Date to ISO string", () => {
      const date = new Date("2023-10-15T12:00:00Z");
      expect(serializePrimitive(date, Date)).toBe("2023-10-15T12:00:00.000Z");
    });

    it("should serialize boolean to lowercase string", () => {
      expect(serializePrimitive(true)).toBe("true");
      expect(serializePrimitive(false)).toBe("false");
    });

    it("should serialize enum values to string", () => {
      expect(serializePrimitive(TestEnum.ValueOne)).toBe("one");
      expect(serializePrimitive(TestEnum.ValueTwo)).toBe("two");
    });

    it("should serialize numbers to string", () => {
      expect(serializePrimitive(123)).toBe("123");
      expect(serializePrimitive(45.67)).toBe("45.67");
    });

    it("should serialize strings as-is", () => {
      expect(serializePrimitive("test")).toBe("test");
      expect(serializePrimitive("")).toBe("");
    });

    it("should handle numeric enum values", () => {
      expect(serializePrimitive(NumericEnum.First)).toBe("1");
      expect(serializePrimitive(NumericEnum.Second)).toBe("2");
    });

    it("should serialize null and undefined", () => {
      expect(serializePrimitive(null)).toBe("null");
      expect(serializePrimitive(undefined)).toBe("undefined");
    });

    it("should serialize objects to string", () => {
      const obj = { foo: "bar" };
      expect(serializePrimitive(obj)).toBe("[object Object]");
    });
  });
});
