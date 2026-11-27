import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { findRepeatedTypes, main, type SourceText } from "../check-anonymous-types.ts";

/**
 * Finds the repeated anonymous types in one file.
 *
 * @param text - The text of the file
 * @returns The repeated types, as their normalized text
 */
function repeatedIn(text: string): string[] {
  return findRepeatedTypes([{ path: "a.ts", text }]).map((repeated) => repeated.type);
}

describe("findRepeatedTypes", () => {
  test("should report an object type that occurs twice, with its places", () => {
    const files: SourceText[] = [
      { path: "a.ts", text: "let a: { name?: string };" },
      { path: "b.ts", text: "\nfunction f(b: {\n  name?: string;\n}): void {}" },
    ];

    expect(findRepeatedTypes(files)).toEqual([{ type: "{ name?: string }", places: ["a.ts:1", "b.ts:2"] }]);
  });

  test.each([
    ["unions in another order", "let a: A | B; let b: B | A;", "A | B"],
    ["unions of literal types", 'let a: "warning" | "error"; let b: "error" | "warning";', '"error" | "warning"'],
    ["function types", "let a: (item: A) => void; let b: (item: A) => void;", "(item: A) => void"],
    [
      "function types with optional and rest parameters",
      "let a: (first?: A, ...rest: B[]) => void; let b: (first?: A, ...rest: B[]) => void;",
      "(first?: A, ...rest: B[]) => void",
    ],
    ["function types with untyped parameters", "let a: (item) => void; let b: (item) => void;", "(item: any) => void"],
    ["functions without parameters that return another type", "let a: () => A; let b: () => A;", "() => A"],
    ["tuples", "let a: [A, B]; let b: [A, B];", "[A, B]"],
  ])("should report %s", (_case, text, type) => {
    expect(repeatedIn(text)).toEqual([type]);
  });

  test.each([
    ["the definition of a named type", "type N = A | B; let a: A | B;"],
    ["X | undefined and X | null", "let a: A | undefined; let b: A | undefined; let c: A | null; let d: A | null;"],
    ["unions of primitive types", "let a: number | string | null; let b: number | string | null;"],
    ["functions without parameters that return a keyword type", "let a: () => void; let b: () => void;"],
    [
      "function types whose parameters have other names",
      "let a: (next: string) => void; let b: (message: string) => void;",
    ],
    [
      "function types that differ in optional or rest parameters",
      "let a: (item: A[]) => void; let b: (item?: A[]) => void; let c: (...item: A[]) => void;",
    ],
    ["an empty object type", "let a: {}; let b: {};"],
  ])("should not report %s", (_case, text) => {
    expect(repeatedIn(text)).toEqual([]);
  });
});

describe("main", () => {
  let dir: string;

  /**
   * Writes a file below the temporary folder.
   *
   * @param path - The path of the file, relative to the folder
   * @param text - The text of the file
   */
  function write(path: string, text: string): void {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "check-anonymous-types-"));
    mkdirSync(join(dir, "src"));
    mkdirSync(join(dir, "scripts"));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("should fail and list the places of a type that occurs in src and scripts", () => {
    write("src/lib/a.ts", "export let a: A | B;");
    write("scripts/b.ts", "export let b: A | B;");

    expect(main(dir)).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      `✗ A | B occurs 2 times: ${join("src", "lib", "a.ts")}:1, ${join("scripts", "b.ts")}:1`
    );
  });

  test("should pass when no type occurs twice", () => {
    write("src/a.ts", "export let a: A | B;");
    write("scripts/b.ts", "export let b: [A, B];");

    expect(main(dir)).toBe(0);
    expect(console.log).toHaveBeenCalledWith("✓ No anonymous type occurs twice in 2 files");
  });

  test("should skip tests, their helpers and files that are not TypeScript", () => {
    write("src/a.ts", "export let a: A | B;");
    write("scripts/b.ts", "export let b: [A, B];");
    write("src/a.test.ts", "let b: A | B;");
    write("scripts/__tests__/helpers.ts", "export let c: A | B;");
    write("scripts/run.mjs", "/** @type {A | B} */ export let d;");

    expect(main(dir)).toBe(0);
    expect(console.log).toHaveBeenCalledWith("✓ No anonymous type occurs twice in 2 files");
  });
});
