import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { editionProblems, loadEdition, loadEditions, missingEdition, parseBaseEdition, writeEdition } from "../lib/compiler-target.ts";
import { base, stubFetch, URLS } from "./testHelpers.ts";

let dir: string;

/**
 * Writes `tsconfig.target.json` into the test folder.
 *
 * @param compilerOptions - Its compiler options
 */
function writeConfig(compilerOptions: object): void {
  writeFileSync(join(dir, "tsconfig.target.json"), JSON.stringify({ compilerOptions }));
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "compiler-target-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

describe("compiler-target", () => {
  describe("parseBaseEdition", () => {
    it("should take the edition from the target in upper case and ignore the libraries", () => {
      expect(parseBaseEdition(JSON.stringify(base(24)), "node24.json")).toBe("ES2024");
    });

    it.each([
      ["{ not json", "node24.json: not valid JSON."],
      ['{ "compilerOptions": { "target": "esnext" } }', 'node24.json: expected a target ESxxxx, found "esnext".'],
      ['{ "compilerOptions": {} }', "node24.json: expected a target ESxxxx, found undefined."],
    ])("should reject %s", (text, message) => {
      expect(() => parseBaseEdition(text, "node24.json")).toThrow(message);
    });
  });

  describe("loadEdition and loadEditions", () => {
    it("should load the editions once per major version and return undefined for a version without a configuration", async () => {
      const fetchMock = stubFetch({ [URLS.base(24)]: base(24), [URLS.base(26)]: base(26) });

      await expect(loadEdition(24)).resolves.toBe("ES2024");
      await expect(loadEditions([24, 25, 26, 24])).resolves.toEqual(new Map([[24, "ES2024"], [25, undefined], [26, "ES2025"]]));
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it("should fail if the request fails for another reason", async () => {
      vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: false, status: 500 })));

      await expect(loadEdition(24)).rejects.toThrow(`${URLS.base(24)}: HTTP 500`);
    });
  });

  describe("editionProblems", () => {
    it("should accept target and lib with the edition in any case", () => {
      writeConfig({ target: "es2024", lib: ["ES2024"] });

      expect(editionProblems(dir, 24, "ES2024")).toEqual([]);
    });

    it("should name target and lib if they differ", () => {
      writeConfig({ target: "ES2022", lib: ["ES2024", "ESNext.Array"] });

      expect(editionProblems(dir, 24, "ES2024")).toEqual([
        "tsconfig.target.json: target is ES2022, expected ES2024",
        "tsconfig.target.json: lib is ES2024, ESNEXT.ARRAY, expected ES2024",
      ]);
    });

    it("should name missing settings and a missing file", () => {
      writeConfig({});
      expect(editionProblems(dir, 24, "ES2024")).toEqual([
        "tsconfig.target.json: target is missing, expected ES2024",
        "tsconfig.target.json: lib is missing, expected ES2024",
      ]);

      rmSync(join(dir, "tsconfig.target.json"));
      expect(editionProblems(dir, 24, "ES2024")).toEqual(["tsconfig.target.json: missing or not valid JSON, expected target and lib ES2024"]);
    });

    it("should report a major version without a configuration", () => {
      expect(editionProblems(dir, 28, undefined)).toEqual([missingEdition(28)]);
      expect(missingEdition(28)).toBe("There is no @tsconfig/bases configuration for Node 28.");
    });
  });

  describe("writeEdition", () => {
    it("should write the edition as target and lib with CRLF line endings", () => {
      writeEdition(dir, "ES2024", true);

      const text = readFileSync(join(dir, "tsconfig.target.json"), "utf8");
      expect(text).toBe('{\r\n  "compilerOptions": {\r\n    "target": "ES2024",\r\n    "lib": [\r\n      "ES2024"\r\n    ]\r\n  }\r\n}\r\n');
      expect(editionProblems(dir, 24, "ES2024")).toEqual([]);
    });
  });
});
