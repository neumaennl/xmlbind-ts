import {
  describeExclusions,
  endOfLife,
  enginesMajor,
  exclusions,
  listLines,
  loadData,
  newestLts,
  runtimeConstraints,
  supportedLines,
  typesNodeMajor,
  typesNodeRange,
  type NodeData,
} from "../lib/node-releases.ts";
import { RELEASES, SCHEDULE, stubFetch, stubNodeData, TYPES_NODE, URLS } from "./testHelpers.ts";

const DATA: NodeData = { schedule: SCHEDULE, releases: RELEASES, typesNode: TYPES_NODE };

/** The constraint that `runtimeConstraints()` adds for `require()` of ES modules. */
const REQUIRE_ESM = { name: "require() of ES modules", range: "^20.19.0 || >=22.12.0" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("node-releases", () => {
  describe("enginesMajor", () => {
    test("should read the major version of >=N", () => {
      expect(enginesMajor(">=24")).toBe(24);
      expect(enginesMajor(">= 24")).toBe(24);
    });

    test.each([undefined, "^24", ">=24.0.0", ">=24 <26"])("should return undefined for %s", (engines) => {
      expect(enginesMajor(engines)).toBeUndefined();
    });
  });

  describe("typesNodeMajor", () => {
    test("should read the major version of ^N.x.y", () => {
      expect(typesNodeMajor("^24.19.2")).toBe(24);
    });

    test.each([undefined, "~24.19.0", "^24", "24.19.2"])("should return undefined for %s", (range) => {
      expect(typesNodeMajor(range)).toBeUndefined();
    });
  });

  describe("typesNodeRange", () => {
    test("should return ^ and the latest @types/node of the major version", () => {
      expect(typesNodeRange(24, TYPES_NODE)).toBe("^24.12.0");
      expect(typesNodeRange(23, TYPES_NODE)).toBeUndefined();
    });
  });

  describe("runtimeConstraints", () => {
    test("should collect the engines.node of the runtime dependencies and add require() of ES modules", () => {
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

  describe("supportedLines", () => {
    test("should list the lines that have started and not reached their end of life", () => {
      expect(supportedLines(SCHEDULE, "2026-10-14")).toEqual([22, 24, 26]);
      expect(supportedLines(SCHEDULE, "2026-05-01")).toEqual([22, 24, 25]);
    });
  });

  describe("exclusions", () => {
    test("should find the first versions of the major version and of newer supported lines that a constraint excludes", () => {
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

    test("should name every constraint that excludes the first version of a line", () => {
      const commander = { name: "commander 15.0.0", range: ">=22.12.0" };

      expect(exclusions(22, SCHEDULE, [commander, REQUIRE_ESM], "2026-10-14")).toEqual([
        { version: "22.0.0", excludedBy: [commander, REQUIRE_ESM] },
      ]);
      expect(exclusions(20, SCHEDULE, [REQUIRE_ESM], "2026-04-01")).toEqual([
        { version: "20.0.0", excludedBy: [REQUIRE_ESM] },
        { version: "22.0.0", excludedBy: [REQUIRE_ESM] },
      ]);
      expect(exclusions(24, SCHEDULE, [commander, REQUIRE_ESM], "2026-10-14")).toEqual([]);
    });

    test("should name the constraint whose range it cannot read", () => {
      expect(() => exclusions(24, SCHEDULE, [{ name: "some-dep 1.0.0", range: "node >= 22" }], "2026-10-14")).toThrow(
        'some-dep 1.0.0: cannot read the Node range "node >= 22" (Not a version: "node")',
      );
    });

    test("should describe exclusions for a message", () => {
      const excluded = [
        { version: "22.0.0", excludedBy: [{ name: "a 1.0.0", range: ">=22.12.0" }, { name: "b", range: ">=24" }] },
        { version: "26.0.0", excludedBy: [{ name: "c", range: "<26" }] },
      ];

      expect(describeExclusions(excluded)).toBe("Node 22.0.0 by a 1.0.0 (>=22.12.0), b (>=24); Node 26.0.0 by c (<26)");
    });
  });

  describe("endOfLife", () => {
    test("should be ok more than 90 days before the end of life", () => {
      expect(endOfLife(24, SCHEDULE, "2028-01-30")).toEqual({ end: "2028-04-30", days: 91, level: "ok" });
    });

    test("should warn in the 90 days before the end of life", () => {
      expect(endOfLife(24, SCHEDULE, "2028-01-31").level).toBe("warning");
      expect(endOfLife(24, SCHEDULE, "2028-04-29")).toEqual({ end: "2028-04-30", days: 1, level: "warning" });
    });

    test("should be an error from the end of life on, and for an unknown line", () => {
      expect(endOfLife(24, SCHEDULE, "2028-04-30").level).toBe("error");
      expect(endOfLife(99, SCHEDULE, "2026-10-14")).toEqual({ level: "error" });
    });
  });

  describe("listLines", () => {
    test("should list the released lines before their end of life and tell which constraints exclude them", () => {
      const commander = { name: "commander 15.0.0", range: ">=22.12.0" };

      expect(listLines(DATA, [commander], "2026-10-14")).toEqual([
        { major: 22, status: "Maintenance LTS", exclusions: [{ version: "22.0.0", excludedBy: [commander] }], typesNode: "^22.13.17", latest: "22.23.3", end: "2027-04-30" },
        { major: 24, status: "Active LTS", exclusions: [], typesNode: "^24.12.0", latest: "24.21.0", end: "2028-04-30" },
        { major: 26, status: "Current", exclusions: [], typesNode: "^26.0.1", latest: "26.11.1", end: "2029-04-30" },
      ]);
    });
  });

  describe("listLines and the status of a line", () => {
    // 27.0.0 is added so that the line can be listed once it has started.
    const data: NodeData = { ...DATA, releases: [...RELEASES, "27.0.0"] };

    test.each([
      ["2027-05-01", 27, "Current"],
      ["2026-10-14", 24, "Active LTS"],
      ["2026-10-14", 22, "Maintenance LTS"],
      ["2026-05-01", 25, "Maintenance"],
    ])("should on %s list %i as %s", (today, major, expected) => {
      expect(listLines(data, [], today).find((row) => row.major === major)?.status).toBe(expected);
    });

    test.each([
      ["2027-04-01", 27, "planned"],
      ["2026-04-30", 20, "at its end of life"],
    ])("should on %s leave out %i, which is %s", (today, major) => {
      expect(listLines(data, [], today).map((row) => row.major)).not.toContain(major);
    });
  });

  describe("newestLts", () => {
    test("should return the newest LTS line", () => {
      expect(newestLts(DATA, "2026-10-14")).toBe(24);
      expect(newestLts(DATA, "2026-10-28")).toBe(26);
    });
  });

  describe("loadData", () => {
    test("should download the schedule, the releases oldest first and the @types/node versions", async () => {
      stubNodeData();

      await expect(loadData()).resolves.toEqual(DATA);
    });

    test("should fail if a download fails", async () => {
      stubFetch({ [URLS.index]: [] });

      await expect(loadData()).rejects.toThrow(`${URLS.schedule}: HTTP 404`);
    });
  });
});
