import { readFileSync } from "fs";

/** The compiler options that decide the ECMAScript edition. */
export interface CompilerTarget {
  target: string;
  lib: string[];
}

/**
 * Reads `target` and `lib` from `tsconfig.target.json`, which the build and the
 * scripts extend, so that the tests and the projects they compile use the same
 * edition. `vitest.config.ts` uses it as well.
 *
 * @returns The target and the libraries
 */
export function compilerTarget(): CompilerTarget {
  const file = new URL("../../tsconfig.target.json", import.meta.url);
  const { compilerOptions } = JSON.parse(readFileSync(file, "utf8")) as { compilerOptions: CompilerTarget };
  return { target: compilerOptions.target, lib: compilerOptions.lib };
}
