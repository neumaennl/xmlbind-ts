import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { offerSteps } from "../lib/update-steps.ts";
import { check, formatTable, main, rejectMajor, update, writeValues } from "../node-version.ts";
import {
  base,
  RELEASES,
  restoreTerminal,
  SCHEDULE,
  stubFetch,
  stubNodeData,
  stubTerminal,
  TYPES_NODE,
  URLS,
} from "./testHelpers.ts";

const asker = { question: vi.fn<(query: string) => Promise<string>>(), close: vi.fn() };

vi.mock("node:readline/promises", () => ({ createInterface: vi.fn(() => asker) }));
vi.mock("../lib/update-steps.ts", () => ({ offerSteps: vi.fn() }));

const TODAY = "2026-10-14";
const DATA = { schedule: SCHEDULE, releases: RELEASES, typesNode: TYPES_NODE };
const CONSTRAINTS = [{ name: "commander 15.0.0", range: ">=22.12.0" }];
const EDITIONS = new Map([
  [22, "ES2022"],
  [24, "ES2024"],
  [26, "ES2025"],
]);
const ES2022 = { target: "ES2022", lib: ["ES2022"] };
const ES2024 = { target: "ES2024", lib: ["ES2024"] };

const PACKAGE_JSON = {
  name: "fixture",
  engines: { node: ">=24" },
  devDependencies: { "@types/node": "^24.12.0" },
};

const PACKAGE_LOCK = {
  packages: {
    "": { name: "fixture" },
    "node_modules/commander": { version: "15.0.0", engines: { node: ">=22.12.0" } },
    "node_modules/eslint": { version: "10.0.0", dev: true, engines: { node: "^22.13.0 || >=24" } },
  },
};

let dir: string;

/** What `writeProject()` changes in the files of the test folder. */
interface ProjectChanges {
  /** Replaces fields of `package.json` */
  pkg?: object;
  /** The content of `.nvmrc`, or null for no file */
  nvmrc?: string | null;
  /** The line endings */
  eol?: string;
  /** The `package-lock.json` */
  lock?: object;
  /** The content of `tsconfig.target.json`, or null for no file */
  target?: object | null;
}

/**
 * Writes `package.json`, `package-lock.json`, `.nvmrc` and `tsconfig.target.json` into the test folder.
 *
 * @param changes - What to change in the files
 */
function writeProject({
  pkg = {},
  nvmrc = "24",
  eol = "\n",
  lock = PACKAGE_LOCK,
  target = ES2024,
}: ProjectChanges = {}): void {
  writeFileSync(
    join(dir, "package.json"),
    `${JSON.stringify({ ...PACKAGE_JSON, ...pkg }, null, 2)}\n`.replace(/\n/g, eol)
  );
  writeFileSync(join(dir, "package-lock.json"), JSON.stringify(lock));
  if (nvmrc !== null) {
    writeFileSync(join(dir, ".nvmrc"), `${nvmrc}${eol}`);
  }
  if (target !== null) {
    writeFileSync(join(dir, "tsconfig.target.json"), JSON.stringify({ compilerOptions: target }));
  }
}

/**
 * Reads a file of the test folder.
 *
 * @param name - The file name
 * @returns The content
 */
function read(name: string): string {
  return readFileSync(join(dir, name), "utf8");
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "node-version-"));
  stubTerminal(false);
  vi.stubEnv("GITHUB_ACTIONS", undefined);
  asker.question.mockReset();
  vi.mocked(offerSteps).mockReset().mockResolvedValue(0);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  restoreTerminal();
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("node-version", () => {
  describe("formatTable", () => {
    test("should align the columns and underline the header", () => {
      expect(formatTable(["A", "Long"], [["xyz", "1"]])).toBe("A    Long\n---  ----\nxyz  1");
    });

    test.each([
      ["fewer", ["xyz"]],
      ["more", ["xyz", "1", "2"]],
    ])("should throw if a row has %s cells than the header", (_, row) => {
      expect(() => formatTable(["A", "Long"], [row])).toThrow(
        `Table row has ${row.length} cells, but the header has 2`
      );
    });
  });

  describe("check", () => {
    test("should return 0 if everything matches and the end of life is far away", async () => {
      writeProject();
      const fetchMock = stubFetch({ [URLS.schedule]: SCHEDULE, [URLS.base(24)]: base(24) });

      await expect(check(dir, TODAY)).resolves.toBe(0);
      expect(console.log).toHaveBeenCalledWith(
        "engines.node, @types/node, .nvmrc, the ECMAScript edition and the runtime dependencies match; Node 24 does not end within 90 days."
      );
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test("should return 1 if engines.node is missing or not of the form >=N", async () => {
      writeProject({ pkg: { engines: { node: ">=24.0.0" } } });

      await expect(check(dir, TODAY)).resolves.toBe(1);
      expect(console.error).toHaveBeenCalledWith(
        'engines.node: is ">=24.0.0", expected ">=" and a major version, for example ">=24".'
      );
    });

    test("should return 1 and name each value that does not match", async () => {
      writeProject({ pkg: { devDependencies: { "@types/node": "^26.4.0" } }, nvmrc: "24.21.0" });
      stubNodeData();

      await expect(check(dir, TODAY)).resolves.toBe(1);
      expect(console.error).toHaveBeenCalledWith('@types/node: is "^26.4.0", expected "^24.x.y".');
      expect(console.error).toHaveBeenCalledWith('.nvmrc: is "24.21.0", expected "24".');
      expect(console.error).toHaveBeenCalledWith("Run `npm run node:update` to fix this.");
    });

    test("should return 1 and name target and lib if tsconfig.target.json names another edition", async () => {
      writeProject({ target: ES2022 });
      stubNodeData();

      await expect(check(dir, TODAY)).resolves.toBe(1);
      expect(console.error).toHaveBeenCalledWith("tsconfig.target.json: target is ES2022, expected ES2024");
      expect(console.error).toHaveBeenCalledWith("tsconfig.target.json: lib is ES2022, expected ES2024");
    });

    test("should return 1 if there is no @tsconfig/bases configuration for the major version", async () => {
      writeProject();
      stubNodeData([URLS.base(24)]);

      await expect(check(dir, TODAY)).resolves.toBe(1);
      expect(console.error).toHaveBeenCalledWith("There is no @tsconfig/bases configuration for Node 24.");
    });

    test("should return 1 if .nvmrc is missing", async () => {
      writeProject({ nvmrc: null });
      stubNodeData();

      await expect(check(dir, TODAY)).resolves.toBe(1);
      expect(console.error).toHaveBeenCalledWith('.nvmrc: is "", expected "24".');
    });

    test("should return 1 if a runtime dependency excludes the first version of the major version", async () => {
      const lock = { packages: { "node_modules/commander": { version: "16.0.0", engines: { node: ">=24.3.0" } } } };
      writeProject({ lock });
      stubNodeData();

      await expect(check(dir, TODAY)).resolves.toBe(1);
      expect(console.error).toHaveBeenCalledWith(
        "engines.node >=24 includes versions that runtime dependencies exclude: Node 24.0.0 by commander 16.0.0 (>=24.3.0)."
      );
    });

    test("should return 1 if a runtime dependency excludes a newer line before its end of life", async () => {
      const lock = { packages: { "node_modules/foo": { version: "1.0.0", engines: { node: ">=24 <26" } } } };
      writeProject({ lock });
      stubNodeData();

      await expect(check(dir, TODAY)).resolves.toBe(1);
      expect(console.error).toHaveBeenCalledWith(
        "engines.node >=24 includes versions that runtime dependencies exclude: Node 26.0.0 by foo 1.0.0 (>=24 <26)."
      );
    });

    test("should ignore newer lines past their end of life that a runtime dependency excludes", async () => {
      const lock = {
        packages: { "node_modules/foo": { version: "1.0.0", engines: { node: "^22.12.0 || ^24.0.0 || >=26" } } },
      };
      writeProject({ lock });
      stubNodeData();

      await expect(check(dir, TODAY)).resolves.toBe(0);
    });

    test("should warn in the 90 days before the end of life and still return 0", async () => {
      writeProject();
      stubNodeData();

      await expect(check(dir, "2028-02-01")).resolves.toBe(0);
      expect(console.warn).toHaveBeenCalledWith("Warning: Node 24 reaches its end of life on 2028-04-30, in 89 days.");
      expect(console.log).toHaveBeenCalledWith(
        "Raise the Node version with `npm run node:update` before the end of life."
      );
    });

    test("should return 1 in the 90 days before the end of life if strict", async () => {
      writeProject();
      stubNodeData();

      await expect(check(dir, "2028-02-01", true)).resolves.toBe(1);
      expect(console.error).toHaveBeenCalledWith("Node 24 reaches its end of life on 2028-04-30, in 89 days.");
      expect(console.warn).not.toHaveBeenCalled();
    });

    test("should return 1 from the end of life on, as a GitHub annotation in GitHub Actions", async () => {
      vi.stubEnv("GITHUB_ACTIONS", "true");
      writeProject();
      stubNodeData();

      await expect(check(dir, "2028-04-30")).resolves.toBe(1);
      expect(console.log).toHaveBeenCalledWith("::error::Node 24 reached its end of life on 2028-04-30.");
    });
  });

  describe("rejectMajor", () => {
    test.each([
      [24, undefined],
      [23, "Node 23 has no release."],
      [25, "Node 25 has reached its end of life or is not in the Node release schedule."],
      [
        22,
        ">=22 would include versions that runtime dependencies exclude: Node 22.0.0 by commander 15.0.0 (>=22.12.0).",
      ],
    ])("should for %s return %s", (major, expected) => {
      expect(rejectMajor(major, DATA, CONSTRAINTS, TODAY, EDITIONS)).toBe(expected);
    });

    test("should reject a major version without @types/node", () => {
      expect(rejectMajor(24, { ...DATA, typesNode: [] }, CONSTRAINTS, TODAY, EDITIONS)).toBe(
        "There is no @types/node 24.x."
      );
    });

    test("should reject a major version without an ECMAScript edition", () => {
      expect(rejectMajor(24, DATA, CONSTRAINTS, TODAY, new Map())).toBe(
        "There is no @tsconfig/bases configuration for Node 24."
      );
    });
  });

  describe("writeValues", () => {
    test("should write the values and keep the other fields and the CRLF line endings", () => {
      const pkg = { devDependencies: { "@types/node": "^26.4.0", typescript: "^6.0.3" } };

      writeValues({ pkg, crlf: true }, { major: 24, typesNode: "^24.12.0", edition: "ES2024" }, dir);

      expect(JSON.parse(read("package.json"))).toEqual({
        devDependencies: { "@types/node": "^24.12.0", typescript: "^6.0.3" },
        engines: { node: ">=24" },
      });
      expect(read("package.json")).toContain("\r\n");
      expect(read(".nvmrc")).toBe("24\r\n");
      expect(JSON.parse(read("tsconfig.target.json"))).toEqual({ compilerOptions: ES2024 });
      expect(read("tsconfig.target.json")).toContain("\r\n");
    });
  });

  describe("update", () => {
    test("should fail without a version if there is no terminal", async () => {
      await expect(update(undefined, dir, TODAY)).rejects.toThrow("Not running in a terminal");
    });

    test("should write the given major version and offer the steps with the latest release", async () => {
      writeProject({ pkg: { engines: {}, devDependencies: { "@types/node": "^26.4.0" } }, nvmrc: null, target: null });
      stubNodeData();

      await expect(update("24", dir, TODAY)).resolves.toBe(0);

      expect(JSON.parse(read("package.json"))).toMatchObject({
        engines: { node: ">=24" },
        devDependencies: { "@types/node": "^24.12.0" },
      });
      expect(read(".nvmrc")).toBe("24\n");
      expect(JSON.parse(read("tsconfig.target.json"))).toEqual({ compilerOptions: ES2024 });
      expect(console.log).toHaveBeenCalledWith(
        "Set engines.node >=24, @types/node ^24.12.0, .nvmrc 24 and the ECMAScript edition ES2024."
      );
      expect(offerSteps).toHaveBeenCalledWith(asker, "24.21.0");
    });

    test.each([
      ["22", "Node 22.0.0 by commander 15.0.0 (>=22.12.0), require() of ES modules"],
      ["24.21.0", 'Not a major version: "24.21.0"'],
    ])("should reject the given version %s and write nothing", async (requested, message) => {
      writeProject();
      stubNodeData();

      await expect(update(requested, dir, TODAY)).rejects.toThrow(message);
      expect(read(".nvmrc")).toBe("24\n");
    });

    test("should reject a version without a @tsconfig/bases configuration and write nothing", async () => {
      writeProject({ target: ES2022 });
      stubNodeData([URLS.base(24)]);

      await expect(update("24", dir, TODAY)).rejects.toThrow("There is no @tsconfig/bases configuration for Node 24.");
      expect(JSON.parse(read("tsconfig.target.json"))).toEqual({ compilerOptions: ES2022 });
    });

    test("should warn when the chosen version ends within 90 days", async () => {
      writeProject();
      stubNodeData();

      await expect(update("24", dir, "2028-03-01")).resolves.toBe(0);
      expect(console.warn).toHaveBeenCalledWith("Warning: Node 24 reaches its end of life on 2028-04-30, in 60 days.");
    });

    test("should show the release lines and ask until the answer is accepted", async () => {
      stubTerminal(true);
      writeProject({ pkg: { engines: { node: ">=22" } }, nvmrc: "22", target: ES2022 });
      stubNodeData();
      asker.question.mockResolvedValueOnce("22").mockResolvedValueOnce("x").mockResolvedValueOnce("");

      await expect(update(undefined, dir, TODAY)).resolves.toBe(0);

      const output = vi
        .mocked(console.log)
        .mock.calls.map((args) => String(args[0]))
        .join("\n");
      expect(output).toMatch(
        /^22 +Maintenance LTS +no: 22\.0\.0 by commander 15\.0\.0, require\(\) of ES modules +\^22\.13\.17 +ES2022 +22\.23\.3 +2027-04-30$/m
      );
      expect(output).toMatch(/^24 +Active LTS +yes +\^24\.12\.0 +ES2024 +24\.21\.0 +2028-04-30$/m);
      expect(output).toContain("Currently: engines.node >=22, @types/node ^24.12.0, .nvmrc 22.");
      expect(output).toContain("Node 22.0.0 by commander 15.0.0 (>=22.12.0), require() of ES modules");
      expect(output).toContain("Enter a major version, for example 24.");
      expect(asker.question).toHaveBeenCalledWith("Node major version [24]: ");
      expect((JSON.parse(read("package.json")) as typeof PACKAGE_JSON).engines.node).toBe(">=24");
      expect(read(".nvmrc")).toBe("24\n");
      expect(JSON.parse(read("tsconfig.target.json"))).toEqual({ compilerOptions: ES2024 });
      expect(offerSteps).toHaveBeenCalledWith(asker, "24.21.0");
    });

    test("should return the exit code of the steps", async () => {
      writeProject();
      stubNodeData();
      vi.mocked(offerSteps).mockResolvedValue(3);

      await expect(update("24", dir, TODAY)).resolves.toBe(3);
    });
  });

  describe("main", () => {
    test.each([[["unknown"]], [["check", "--bogus"]], [["update", "24", "26"]]])(
      "should print the usage and return 2 for %j",
      async (args) => {
        await expect(main(args)).resolves.toBe(2);
        expect(console.error).toHaveBeenCalledWith(
          "Usage: node scripts/node-version.ts check [--strict] | update [major]"
        );
      }
    );
  });
});
