import {
  describeExclusions,
  endOfLife,
  enginesMajor,
  exclusions,
  latestOfMajor,
  lineStatus,
  listLines,
  loadData,
  newestLts,
  parseVersion,
  REQUIRE_ESM,
  runtimeConstraints,
  satisfies,
  supportedLines,
  typesNodeMajor,
  typesNodeRange,
  violated,
  type NodeData,
} from "../lib/node-releases.ts";
import { RELEASES, SCHEDULE, stubFetch, stubNodeData, TYPES_NODE, URLS } from "./testHelpers.ts";

const DATA: NodeData = { schedule: SCHEDULE, releases: RELEASES, typesNode: TYPES_NODE };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("node-releases", () => {
  describe("parseVersion", () => {
    it("should parse a version with or without v", () => {
      expect(parseVersion("22.12.0")).toEqual([22, 12, 0]);
      expect(parseVersion("v24.21.0")).toEqual([24, 21, 0]);
    });

    it("should reject a partial version", () => {
      expect(() => parseVersion("22.12")).toThrow('Not a version: "22.12"');
    });
  });

  describe("enginesMajor", () => {
    it("should read the major version of >=N", () => {
      expect(enginesMajor(">=24")).toBe(24);
      expect(enginesMajor(">= 24")).toBe(24);
    });

    it.each([undefined, "^24", ">=24.0.0", ">=24 <26"])("should return undefined for %s", (engines) => {
      expect(enginesMajor(engines)).toBeUndefined();
    });
  });

  describe("typesNodeMajor", () => {
    it("should read the major version of ^N.x.y", () => {
      expect(typesNodeMajor("^24.19.2")).toBe(24);
    });

    it.each([undefined, "~24.19.0", "^24", "24.19.2"])("should return undefined for %s", (range) => {
      expect(typesNodeMajor(range)).toBeUndefined();
    });
  });

  describe("satisfies", () => {
    it.each([
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

    it("should reject an unknown range", () => {
      expect(() => satisfies("22.12.0", "node >= 22")).toThrow("Not a version");
    });
  });

  describe("latestOfMajor and typesNodeRange", () => {
    it("should find the latest version of a major version, without pre-releases", () => {
      expect(latestOfMajor(["24.12.0", "24.19.2", "24.20.0-rc.1", "26.6.5"], 24)).toBe("24.19.2");
      expect(latestOfMajor(["24.12.0"], 26)).toBeUndefined();
    });

    it("should return ^ and the latest @types/node of the major version", () => {
      expect(typesNodeRange(24, TYPES_NODE)).toBe("^24.12.0");
      expect(typesNodeRange(23, TYPES_NODE)).toBeUndefined();
    });
  });

  describe("runtimeConstraints", () => {
    it("should collect the engines.node of the runtime dependencies and add require() of ES modules", () => {
      const lock = {
        packages: {
          "": { engines: { node: ">=24" } },
          "node_modules/commander": { version: "15.0.0", engines: { node: ">=22.12.0" } },
          "node_modules/@xmldom/xmldom": { version: "0.9.12", engines: { node: ">=14.6" } },
          "node_modules/a/node_modules/b": { version: "1.0.0", engines: { node: ">=16" } },
          "node_modules/eslint": { version: "10.0.0", dev: true, engines: { node: ">=24" } },
          "node_modules/fsevents": { version: "2.3.3", devOptional: true, engines: { node: ">=24" } },
          "node_modules/old": { version: "1.0.0", engines: ["node >= 0.8"] },
          "node_modules/tslib": { version: "2.8.1" },
        },
      };

      expect(runtimeConstraints(lock)).toEqual([
        { name: "commander 15.0.0", range: ">=22.12.0" },
        { name: "@xmldom/xmldom 0.9.12", range: ">=14.6" },
        { name: "b 1.0.0", range: ">=16" },
        REQUIRE_ESM,
      ]);
    });
  });

  describe("violated", () => {
    it("should name the constraints that exclude the first version of the major version", () => {
      const constraints = [{ name: "commander 15.0.0", range: ">=22.12.0" }, REQUIRE_ESM];

      expect(violated(22, constraints)).toEqual(constraints);
      expect(violated(20, [REQUIRE_ESM])).toEqual([REQUIRE_ESM]);
      expect(violated(24, constraints)).toEqual([]);
    });

    it("should name the constraint whose range it cannot read", () => {
      expect(() => violated(24, [{ name: "some-dep 1.0.0", range: "node >= 22" }])).toThrow(
        'some-dep 1.0.0: cannot read the Node range "node >= 22" (Not a version: "node")',
      );
    });
  });

  describe("supportedLines", () => {
    it("should list the lines that have started and not reached their end of life", () => {
      expect(supportedLines(SCHEDULE, "2026-10-14")).toEqual([22, 24, 26]);
      expect(supportedLines(SCHEDULE, "2026-05-01")).toEqual([22, 24, 25]);
    });
  });

  describe("exclusions", () => {
    it("should find the first versions of the major version and of newer supported lines that a constraint excludes", () => {
      const upper = { name: "foo 1.0.0", range: ">=24 <26" };
      const commander = { name: "commander 15.0.0", range: ">=22.12.0" };

      expect(exclusions(22, SCHEDULE, [commander, upper], "2026-10-14")).toEqual([
        { version: "22.0.0", excludedBy: [commander, upper] },
        { version: "26.0.0", excludedBy: [upper] },
      ]);
      expect(exclusions(24, SCHEDULE, [{ name: "bar", range: "^24.0.0 || >=26" }], "2026-10-14")).toEqual([]);
      expect(exclusions(24, SCHEDULE, [{ name: "bar", range: "^24.0.0 || >=26" }], "2026-05-01")).toEqual([
        { version: "25.0.0", excludedBy: [{ name: "bar", range: "^24.0.0 || >=26" }] },
      ]);
    });

    it("should describe exclusions for a message", () => {
      const excluded = [
        { version: "22.0.0", excludedBy: [{ name: "a 1.0.0", range: ">=22.12.0" }, { name: "b", range: ">=24" }] },
        { version: "26.0.0", excludedBy: [{ name: "c", range: "<26" }] },
      ];

      expect(describeExclusions(excluded)).toBe("Node 22.0.0 by a 1.0.0 (>=22.12.0), b (>=24); Node 26.0.0 by c (<26)");
    });
  });

  describe("lineStatus", () => {
    it.each([
      ["2027-05-01", "v27", "Current"],
      ["2027-04-01", "v27", "Planned"],
      ["2026-10-14", "v24", "Active LTS"],
      ["2026-10-14", "v22", "Maintenance LTS"],
      ["2026-05-01", "v25", "Maintenance"],
      ["2026-04-30", "v20", "End of life"],
    ] as const)("should on %s describe %s as %s", (today, line, expected) => {
      expect(lineStatus(SCHEDULE[line], today)).toBe(expected);
    });
  });

  describe("endOfLife", () => {
    it("should be ok more than 90 days before the end of life", () => {
      expect(endOfLife(24, SCHEDULE, "2028-01-30")).toEqual({ end: "2028-04-30", days: 91, level: "ok" });
    });

    it("should warn in the 90 days before the end of life", () => {
      expect(endOfLife(24, SCHEDULE, "2028-01-31").level).toBe("warning");
      expect(endOfLife(24, SCHEDULE, "2028-04-29")).toEqual({ end: "2028-04-30", days: 1, level: "warning" });
    });

    it("should be an error from the end of life on, and for an unknown line", () => {
      expect(endOfLife(24, SCHEDULE, "2028-04-30").level).toBe("error");
      expect(endOfLife(99, SCHEDULE, "2026-10-14")).toEqual({ level: "error" });
    });
  });

  describe("listLines", () => {
    it("should list the released lines before their end of life and tell which constraints exclude them", () => {
      const commander = { name: "commander 15.0.0", range: ">=22.12.0" };

      expect(listLines(DATA, [commander], "2026-10-14")).toEqual([
        { major: 22, status: "Maintenance LTS", exclusions: [{ version: "22.0.0", excludedBy: [commander] }], typesNode: "^22.13.17", latest: "22.23.3", end: "2027-04-30" },
        { major: 24, status: "Active LTS", exclusions: [], typesNode: "^24.12.0", latest: "24.21.0", end: "2028-04-30" },
        { major: 26, status: "Current", exclusions: [], typesNode: "^26.0.1", latest: "26.11.1", end: "2029-04-30" },
      ]);
    });
  });

  describe("newestLts", () => {
    it("should return the newest LTS line", () => {
      expect(newestLts(DATA, "2026-10-14")).toBe(24);
      expect(newestLts(DATA, "2026-10-28")).toBe(26);
    });
  });

  describe("loadData", () => {
    it("should download the schedule, the releases oldest first and the @types/node versions", async () => {
      stubNodeData();

      await expect(loadData()).resolves.toEqual(DATA);
    });

    it("should fail if a download fails", async () => {
      stubFetch({ [URLS.index]: [] });

      await expect(loadData()).rejects.toThrow(`${URLS.schedule}: HTTP 404`);
    });
  });
});
