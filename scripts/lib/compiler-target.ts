// Looks up the ECMAScript edition for a Node major version in the @tsconfig/bases
// configurations, and reads and writes it in `tsconfig.target.json`, which the
// build and the scripts extend. Used by node-version.ts.
//
// The edition is only the `target` of the base (for example `es2024` for Node 24);
// its `ESNext.*` libraries are left out, because their content changes with every
// TypeScript release. `tsconfig.target.json` names the edition as `target` and as
// the only entry of `lib`.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** The file with the ECMAScript edition of the project. */
export const TARGET_FILE = "tsconfig.target.json";

const EDITION = /^es\d{4}$/i;

/**
 * Returns the URL of the @tsconfig/bases configuration for a Node major version.
 *
 * @param major - The major version of Node
 * @returns The URL
 */
export function baseUrl(major: number): string {
  return `https://raw.githubusercontent.com/tsconfig/bases/main/bases/node${major}.json`;
}

/**
 * Takes the ECMAScript edition from the `target` of a @tsconfig/bases configuration.
 *
 * @param text - The configuration
 * @param url - Where it comes from, for messages
 * @returns The edition in upper case, for example `ES2024`
 * @throws {Error} If the text is not JSON or its target is not an edition `ESxxxx`
 */
export function parseBaseEdition(text: string, url: string): string {
  let config: { compilerOptions?: { target?: unknown } };
  try {
    config = JSON.parse(text) as typeof config;
  } catch {
    throw new Error(`${url}: not valid JSON.`);
  }
  const target = config.compilerOptions?.target;
  if (typeof target !== "string" || !EDITION.test(target)) {
    throw new Error(`${url}: expected a target ESxxxx, found ${JSON.stringify(target)}.`);
  }
  return target.toUpperCase();
}

/**
 * Downloads the ECMAScript edition of the @tsconfig/bases configuration for a Node major version.
 *
 * @param major - The major version of Node
 * @returns The edition, or undefined if there is no configuration for the version
 * @throws {Error} If the request fails for another reason or the configuration has no edition
 */
export async function loadEdition(major: number): Promise<string | undefined> {
  const url = baseUrl(major);
  const response = await fetch(url);
  if (response.status === 404) {
    return undefined;
  }
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status}`);
  }
  return parseBaseEdition(await response.text(), url);
}

/**
 * Downloads the ECMAScript editions for several Node major versions.
 *
 * @param majors - The major versions of Node
 * @returns The edition per major version, undefined for those without a configuration
 */
export async function loadEditions(majors: number[]): Promise<Map<number, string | undefined>> {
  const unique = [...new Set(majors)];
  const editions = await Promise.all(unique.map(loadEdition));
  return new Map(unique.map((major, i) => [major, editions[i]]));
}

/**
 * Describes why a Node major version has no usable edition.
 *
 * @param major - The major version of Node
 * @returns The message
 */
export function missingEdition(major: number): string {
  return `There is no @tsconfig/bases configuration for Node ${major}.`;
}

/**
 * Checks `tsconfig.target.json` against the ECMAScript edition of a Node major version.
 *
 * @param dir - The folder with `tsconfig.target.json`
 * @param major - The major version of Node
 * @param edition - Its edition from @tsconfig/bases, or undefined if there is none
 * @returns One message per problem, empty if `target` and `lib` name the edition
 */
export function editionProblems(dir: string, major: number, edition: string | undefined): string[] {
  if (!edition) {
    return [missingEdition(major)];
  }
  let options: { target?: unknown; lib?: unknown };
  try {
    options = (JSON.parse(readFileSync(join(dir, TARGET_FILE), "utf8")) as { compilerOptions?: typeof options }).compilerOptions ?? {};
  } catch {
    return [`${TARGET_FILE}: missing or not valid JSON, expected target and lib ${edition}`];
  }
  const show = (value: unknown): string => (typeof value === "string" ? value.toUpperCase() : JSON.stringify(value) ?? "missing");
  const problems: string[] = [];
  if (show(options.target) !== edition) {
    problems.push(`${TARGET_FILE}: target is ${show(options.target)}, expected ${edition}`);
  }
  const lib = Array.isArray(options.lib) ? options.lib.map(show).join(", ") : show(options.lib);
  if (lib !== edition) {
    problems.push(`${TARGET_FILE}: lib is ${lib}, expected ${edition}`);
  }
  return problems;
}

/**
 * Writes the ECMAScript edition into `tsconfig.target.json`, as `target` and as
 * the only entry of `lib`.
 *
 * @param dir - The folder with `tsconfig.target.json`
 * @param edition - The edition, for example `ES2024`
 * @param crlf - Whether to write CRLF line endings
 */
export function writeEdition(dir: string, edition: string, crlf: boolean): void {
  const text = `${JSON.stringify({ compilerOptions: { target: edition, lib: [edition] } }, null, 2)}\n`;
  writeFileSync(join(dir, TARGET_FILE), crlf ? text.replace(/\n/g, "\r\n") : text);
}
