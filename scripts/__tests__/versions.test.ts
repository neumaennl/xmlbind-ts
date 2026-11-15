import { latestOfMajor, parseVersion, satisfies } from "../lib/versions.ts";

describe("versions", () => {
  describe("parseVersion", () => {
    test("should parse a version with or without v", () => {
      expect(parseVersion("22.12.0")).toEqual([22, 12, 0]);
      expect(parseVersion("v24.21.0")).toEqual([24, 21, 0]);
    });

    test("should reject a partial version", () => {
      expect(() => parseVersion("22.12")).toThrow('Not a version: "22.12"');
    });
  });

  describe("satisfies", () => {
    test.each([
      ["22.12.0", ">=22.12.0", true],
      ["22.11.9", ">=22.12.0", false],
      ["20.19.0", "^20.19.0 || >=22.12.0", true],
      ["21.0.0", "^20.19.0 || >=22.12.0", false],
      ["24.0.0", "^20.19.0 || >=22.12.0", true],
      ["22.13.0", "^20.19.0 || ^22.13.0 || >=24", true],
      ["23.0.0", "^20.19.0 || ^22.13.0 || >=24", false],
      ["24.0.0", "^20.19.0 || ^22.13.0 || >=24", true],
      ["14.6.0", ">=14.6", true],
      ["14.5.9", ">=14.6", false],
      ["14.6.0", ">= 14.6", true],
      ["22.5.0", "22.x", true],
      ["23.0.0", "22", false],
      ["22.1.0", "~22.0.0", false],
      ["22.0.9", "~22.0.0", true],
      ["0.2.9", "^0.2.3", true],
      ["0.3.0", "^0.2.3", false],
      ["0.0.4", "^0.0.3", false],
      ["23.0.0", ">22", true],
      ["22.9.0", ">22", false],
      ["22.12.1", ">22.12.0", true],
      ["22.12.0", "<=22.12", true],
      ["22.13.0", "<=22.12", false],
      ["18.0.0", ">=16 <20", true],
      ["20.0.0", ">=16 <20", false],
      ["21.5.0", "18 - 21", true],
      ["22.0.0", "18 - 21", false],
      ["21.1.0", "18 - 21.0.5", false],
      ["5.0.0", "*", true],
      ["5.0.0", "", true],
      ["18.0.0", ">=18.0.0-0", true],
      ["17.9.9", ">=18.0.0-0", false],
      ["24.3.0", ">24.3.0-beta.1", true],
      ["25.9.9", "<26.0.0-0", true],
      ["26.0.0", "<26.0.0-0", false],
      ["26.0.0", "<=26.0.0-rc.1", false],
      ["18.5.0", "^18.0.0-0", true],
      ["19.0.0", "^18.0.0-0", false],
      ["24.0.0", "24.0.0-rc.1", false],
      ["24.0.0", "18.0.0-0 - 24.0.0", true],
      ["24.0.0", "18 - 24.0.0-rc.1", false],
      ["24.0.0", ">=24.0.0+build.1", true],
    ])("should tell whether %s is in %s", (version, range, expected) => {
      expect(satisfies(version, range)).toBe(expected);
    });

    test("should reject an unknown range", () => {
      expect(() => satisfies("22.12.0", "node >= 22")).toThrow("Not a version");
    });
  });

  describe("latestOfMajor", () => {
    test("should find the latest version of a major version, without pre-releases", () => {
      expect(latestOfMajor(["24.12.0", "24.19.2", "24.20.0-rc.1", "26.6.5"], 24)).toBe("24.19.2");
      expect(latestOfMajor(["24.12.0"], 26)).toBeUndefined();
    });
  });
});
