import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installNode, runWith } from "../lib/node-setup.ts";
import { check, formatTable, main, rejectMajor, update, writeValues } from "../node-version.ts";
import { RELEASES, SCHEDULE, stubFetch, stubNodeData, TYPES_NODE, URLS } from "./testHelpers.ts";

const asker = { question: vi.fn<(query: string) => Promise<string>>(), close: vi.fn() };

vi.mock("node:readline/promises", () => ({ createInterface: vi.fn(() => asker) }));
vi.mock("../lib/node-setup.ts", () => ({ installNode: vi.fn(), runWith: vi.fn() }));

const TODAY = "2026-10-14";
const DATA = { schedule: SCHEDULE, releases: RELEASES, typesNode: TYPES_NODE };
const CONSTRAINTS = [{ name: "commander 15.0.0", range: ">=22.12.0" }];

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

const realIsTTY = Object.getOwnPropertyDescriptor(process.stdin, "isTTY") ?? { value: undefined, configurable: true };

let dir: string;

/**
 * Writes `package.json`, `package-lock.json` and `.nvmrc` into the test folder.
 *
 * @param options - What to change in the files
 * @param options.pkg - Replaces fields of `package.json`
 * @param options.nvmrc - The content of `.nvmrc`, or null for no file
 * @param options.eol - The line endings
 * @param options.lock - The `package-lock.json`
 */
function writeProject({ pkg = {}, nvmrc = "24" as string | null, eol = "\n", lock = PACKAGE_LOCK as object } = {}): void {
  writeFileSync(join(dir, "package.json"), `${JSON.stringify({ ...PACKAGE_JSON, ...pkg }, null, 2)}\n`.replace(/\n/g, eol));
  writeFileSync(join(dir, "package-lock.json"), JSON.stringify(lock));
  if (nvmrc !== null) {
    writeFileSync(join(dir, ".nvmrc"), `${nvmrc}${eol}`);
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

/**
 * Makes `process.stdin` look like a terminal or not, until the end of the test.
 *
 * @param isTTY - Whether standard input is a terminal
 */
function stubTerminal(isTTY: boolean): void {
  Object.defineProperty(process.stdin, "isTTY", { value: isTTY, configurable: true });
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "node-version-"));
  stubTerminal(false);
  vi.stubEnv("GITHUB_ACTIONS", undefined);
  asker.question.mockReset();
  vi.mocked(installNode).mockReset();
  vi.mocked(runWith).mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  Object.defineProperty(process.stdin, "isTTY", realIsTTY);
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("node-version", () => {
  describe("formatTable", () => {
    it("should align the columns and underline the header", () => {
      expect(formatTable(["A", "Long"], [["xyz", "1"]])).toBe("A    Long\n---  ----\nxyz  1");
    });
  });

  describe("check", () => {
    it("should return 0 if everything matches and the end of life is far away", async () => {
      writeProject();
      const fetchMock = stubFetch({ [URLS.schedule]: SCHEDULE });

      await expect(check(dir, TODAY)).resolves.toBe(0);
      expect(console.log).toHaveBeenCalledWith(
        "engines.node, @types/node, .nvmrc and the runtime dependencies match; Node 24 does not end within 90 days.",
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("should return 1 if engines.node is missing or not of the form >=N", async () => {
      writeProject({ pkg: { engines: { node: ">=24.0.0" } } });

      await expect(check(dir, TODAY)).resolves.toBe(1);
      expect(console.error).toHaveBeenCalledWith('engines.node: is ">=24.0.0", expected ">=" and a major version, for example ">=24".');
    });

    it("should return 1 and name each value that does not match", async () => {
      writeProject({ pkg: { devDependencies: { "@types/node": "^26.4.0" } }, nvmrc: "24.21.0" });
      stubNodeData();

      await expect(check(dir, TODAY)).resolves.toBe(1);
      expect(console.error).toHaveBeenCalledWith('@types/node: is "^26.4.0", expected "^24.x.y".');
      expect(console.error).toHaveBeenCalledWith('.nvmrc: is "24.21.0", expected "24".');
      expect(console.error).toHaveBeenCalledWith("Run `npm run node:update` to fix this.");
    });

    it("should return 1 if .nvmrc is missing", async () => {
      writeProject({ nvmrc: null });
      stubNodeData();

      await expect(check(dir, TODAY)).resolves.toBe(1);
      expect(console.error).toHaveBeenCalledWith('.nvmrc: is "", expected "24".');
    });

    it("should return 1 if a runtime dependency excludes the first version of the major version", async () => {
      const lock = { packages: { "node_modules/commander": { version: "16.0.0", engines: { node: ">=24.3.0" } } } };
      writeProject({ lock });
      stubNodeData();

      await expect(check(dir, TODAY)).resolves.toBe(1);
      expect(console.error).toHaveBeenCalledWith(
        "engines.node >=24 includes versions that runtime dependencies exclude: Node 24.0.0 by commander 16.0.0 (>=24.3.0).",
      );
    });

    it("should return 1 if a runtime dependency excludes a newer line before its end of life", async () => {
      const lock = { packages: { "node_modules/foo": { version: "1.0.0", engines: { node: ">=24 <26" } } } };
      writeProject({ lock });
      stubNodeData();

      await expect(check(dir, TODAY)).resolves.toBe(1);
      expect(console.error).toHaveBeenCalledWith(
        "engines.node >=24 includes versions that runtime dependencies exclude: Node 26.0.0 by foo 1.0.0 (>=24 <26).",
      );
    });

    it("should ignore newer lines past their end of life that a runtime dependency excludes", async () => {
      const lock = { packages: { "node_modules/foo": { version: "1.0.0", engines: { node: "^22.12.0 || ^24.0.0 || >=26" } } } };
      writeProject({ lock });
      stubNodeData();

      await expect(check(dir, TODAY)).resolves.toBe(0);
    });

    it("should warn in the 90 days before the end of life and still return 0", async () => {
      writeProject();
      stubNodeData();

      await expect(check(dir, "2028-02-01")).resolves.toBe(0);
      expect(console.warn).toHaveBeenCalledWith("Warning: Node 24 reaches its end of life on 2028-04-30, in 89 days.");
      expect(console.log).toHaveBeenCalledWith("Raise the Node version with `npm run node:update` before the end of life.");
    });

    it("should return 1 in the 90 days before the end of life if strict", async () => {
      writeProject();
      stubNodeData();

      await expect(check(dir, "2028-02-01", true)).resolves.toBe(1);
      expect(console.error).toHaveBeenCalledWith("Node 24 reaches its end of life on 2028-04-30, in 89 days.");
      expect(console.warn).not.toHaveBeenCalled();
    });

    it("should return 1 from the end of life on, as a GitHub annotation in GitHub Actions", async () => {
      vi.stubEnv("GITHUB_ACTIONS", "true");
      writeProject();
      stubNodeData();

      await expect(check(dir, "2028-04-30")).resolves.toBe(1);
      expect(console.log).toHaveBeenCalledWith("::error::Node 24 reached its end of life on 2028-04-30.");
    });
  });

  describe("rejectMajor", () => {
    it.each([
      [24, undefined],
      [23, "Node 23 has no release."],
      [25, "Node 25 has reached its end of life or is not in the Node release schedule."],
      [22, ">=22 would include versions that runtime dependencies exclude: Node 22.0.0 by commander 15.0.0 (>=22.12.0)."],
    ])("should for %s return %s", (major, expected) => {
      expect(rejectMajor(major, DATA, CONSTRAINTS, TODAY)).toBe(expected);
    });

    it("should reject a major version without @types/node", () => {
      expect(rejectMajor(24, { ...DATA, typesNode: [] }, CONSTRAINTS, TODAY)).toBe("There is no @types/node 24.x.");
    });
  });

  describe("writeValues", () => {
    it("should write the values and keep the other fields and the CRLF line endings", () => {
      const pkg = { devDependencies: { "@types/node": "^26.4.0", typescript: "^6.0.3" } };

      writeValues({ pkg, crlf: true }, { major: 24, typesNode: "^24.12.0" }, dir);

      expect(JSON.parse(read("package.json"))).toEqual({
        devDependencies: { "@types/node": "^24.12.0", typescript: "^6.0.3" },
        engines: { node: ">=24" },
      });
      expect(read("package.json")).toContain("\r\n");
      expect(read(".nvmrc")).toBe("24\r\n");
    });
  });

  describe("update", () => {
    it("should fail without a version if there is no terminal", async () => {
      await expect(update(undefined, dir, TODAY)).rejects.toThrow("Not running in a terminal");
    });

    it("should write the given major version and print the steps without a terminal", async () => {
      writeProject({ pkg: { engines: {}, devDependencies: { "@types/node": "^26.4.0" } }, nvmrc: null });
      stubNodeData();

      await expect(update("24", dir, TODAY)).resolves.toBe(0);

      expect(JSON.parse(read("package.json"))).toMatchObject({
        engines: { node: ">=24" },
        devDependencies: { "@types/node": "^24.12.0" },
      });
      expect(read(".nvmrc")).toBe("24\n");
      expect(console.log).toHaveBeenCalledWith("Install and use Node 24.21.0, then run:\n  npm install\n  npm run lint\n  npm test");
      expect(installNode).not.toHaveBeenCalled();
    });

    it.each([
      ["22", "Node 22.0.0 by commander 15.0.0 (>=22.12.0), require() of ES modules"],
      ["24.21.0", 'Not a major version: "24.21.0"'],
    ])("should reject the given version %s and write nothing", async (requested, message) => {
      writeProject();
      stubNodeData();

      await expect(update(requested, dir, TODAY)).rejects.toThrow(message);
      expect(read(".nvmrc")).toBe("24\n");
    });

    it("should warn when the chosen version ends within 90 days", async () => {
      writeProject();
      stubNodeData();

      await expect(update("24", dir, "2028-03-01")).resolves.toBe(0);
      expect(console.warn).toHaveBeenCalledWith("Warning: Node 24 reaches its end of life on 2028-04-30, in 60 days.");
    });

    it("should show the release lines, ask until the answer is accepted, and run the steps with the latest release", async () => {
      stubTerminal(true);
      writeProject({ pkg: { engines: { node: ">=22" } }, nvmrc: "22" });
      stubNodeData();
      asker.question.mockResolvedValueOnce("22").mockResolvedValueOnce("x").mockResolvedValueOnce("").mockResolvedValueOnce("y");
      vi.mocked(installNode).mockReturnValue("/node/24.21.0/bin");
      vi.mocked(runWith).mockReturnValue(0);

      await expect(update(undefined, dir, TODAY)).resolves.toBe(0);

      const output = vi.mocked(console.log).mock.calls.map((args) => String(args[0])).join("\n");
      expect(output).toMatch(/^22 +Maintenance LTS +no: 22\.0\.0 by commander 15\.0\.0, require\(\) of ES modules +\^22\.13\.17 +22\.23\.3 +2027-04-30$/m);
      expect(output).toMatch(/^24 +Active LTS +yes +\^24\.12\.0 +24\.21\.0 +2028-04-30$/m);
      expect(output).toContain("Node 22.0.0 by commander 15.0.0 (>=22.12.0), require() of ES modules");
      expect(output).toContain("Enter a major version, for example 24.");
      expect(asker.question).toHaveBeenCalledWith("Node major version [24]: ");
      expect(JSON.parse(read("package.json")).engines.node).toBe(">=24");
      expect(read(".nvmrc")).toBe("24\n");
      expect(installNode).toHaveBeenCalledWith("24.21.0");
      expect(runWith).toHaveBeenCalledWith("/node/24.21.0/bin", ["npm install", "npm run lint", "npm test"]);
    });

    it("should stop with exit code 1 if the Node version cannot be installed", async () => {
      stubTerminal(true);
      writeProject();
      stubNodeData();
      asker.question.mockResolvedValue("");
      vi.mocked(installNode).mockReturnValue(undefined);

      await expect(update("24", dir, TODAY)).resolves.toBe(1);
      expect(console.error).toHaveBeenCalledWith("Could not install Node 24.21.0 with nvm, nvm-windows or fnm.");
      expect(runWith).not.toHaveBeenCalled();
    });

    it("should return the exit code of a failed step", async () => {
      stubTerminal(true);
      writeProject();
      stubNodeData();
      asker.question.mockResolvedValue("");
      vi.mocked(installNode).mockReturnValue("/node/24.21.0/bin");
      vi.mocked(runWith).mockReturnValue(3);

      await expect(update("24", dir, TODAY)).resolves.toBe(3);
    });
  });

  describe("main", () => {
    it.each([[["unknown"]], [["check", "--bogus"]], [["update", "24", "26"]]])("should print the usage and return 2 for %j", async (args) => {
      await expect(main(args)).resolves.toBe(2);
      expect(console.error).toHaveBeenCalledWith("Usage: node scripts/node-version.ts check [--strict] | update [major]");
    });
  });
});
