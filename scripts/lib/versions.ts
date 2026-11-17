// Parses and compares Node versions, and tells whether a version is in a range
// of the form that engines.node uses. Used by node-releases.ts and node-version.ts.

/** A parsed version: major, minor and patch. */
export type Version = [number, number, number];

/**
 * Parses a version like `24.15.0`, optionally prefixed with `v`.
 *
 * @param text - The version
 * @returns Major, minor and patch
 * @throws An {@link Error} if the text is not a version
 */
export function parseVersion(text: string): Version {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(text.trim());
  if (!match) {
    throw new Error(`Not a version: "${text}"`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Tells whether a text is a version like `24.15.0`.
 *
 * @param text - The text
 * @returns Whether it is a version
 */
export function isVersion(text: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(text);
}

/**
 * Compares two parsed versions.
 *
 * @param a - The first version
 * @param b - The second version
 * @returns A negative number, zero or a positive number if `a` is lower, equal or higher
 */
export function compareVersions(a: Version, b: Version): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

type Operator = ">=" | ">" | "<=" | "<";

interface Comparator {
  op: Operator;
  version: Version;
}

/**
 * Parses a partial version like `24`, `24.15`, `24.x`, `*` or `24.0.0-0`.
 *
 * @param text - The partial version
 * @returns The given parts, without the wildcards and what follows them, and
 *   whether the version has a pre-release tag
 * @throws An {@link Error} if the text is not a partial version
 */
function parsePartial(text: string): { parts: number[]; pre: boolean } {
  const match = /^v?(\d+|[xX*])?(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*])(-[0-9A-Za-z.-]+)?)?(?:\+[0-9A-Za-z.-]+)?$/.exec(
    text
  );
  if (!match) {
    throw new Error(`Not a version: "${text}"`);
  }
  const parts: number[] = [];
  for (const part of [match[1], match[2], match[3]]) {
    if (part === undefined || /[xX*]/.test(part)) {
      break;
    }
    parts.push(Number(part));
  }
  return { parts, pre: match[4] !== undefined && parts.length === 3 };
}

/**
 * Turns one comparator of a range, for example `>=22.12.0`, `^20.19` or `22.x`,
 * into simple comparators. Only released versions are compared, so a bound with
 * a pre-release tag counts as the release that follows it: `>=18.0.0-0` and
 * `>18.0.0-0` include 18.0.0, `<26.0.0-0` and `<=26.0.0-0` exclude 26.0.0.
 *
 * @param token - The comparator
 * @returns The simple comparators, which all have to match
 */
function toComparators(token: string): Comparator[] {
  const [, op = "", rest = ""] = /^(>=|<=|>|<|=|\^|~)?(.*)$/.exec(token) ?? [];
  const { parts, pre } = parsePartial(rest);
  const [a = 0, b = 0, c = 0] = parts;
  const lower: Version = [a, b, c];
  const nextOf = (n: number): Version => (n === 1 ? [a + 1, 0, 0] : n === 2 ? [a, b + 1, 0] : [a, b, c + 1]);
  const next = nextOf(parts.length);
  const none: Comparator[] = [{ op: "<", version: [0, 0, 0] }];
  if (parts.length === 0) {
    return op === ">" || op === "<" ? none : [];
  }
  switch (op) {
    case ">=":
      return [{ op: ">=", version: lower }];
    case ">":
      return [parts.length === 3 ? { op: pre ? ">=" : ">", version: lower } : { op: ">=", version: next }];
    case "<":
      return [{ op: "<", version: lower }];
    case "<=":
      return [parts.length === 3 ? { op: pre ? "<" : "<=", version: lower } : { op: "<", version: next }];
    case "~":
      return [
        { op: ">=", version: lower },
        { op: "<", version: nextOf(Math.min(parts.length, 2)) },
      ];
    case "^": {
      const significant = a > 0 ? 1 : b > 0 ? 2 : parts.length;
      return [
        { op: ">=", version: lower },
        { op: "<", version: nextOf(significant) },
      ];
    }
    default:
      if (pre) {
        return none;
      }
      return [
        { op: ">=", version: lower },
        { op: "<", version: next },
      ];
  }
}

/**
 * Parses one set of a range (the part between `||`), including hyphen ranges
 * like `20 - 22`.
 *
 * @param set - The set
 * @returns The simple comparators, which all have to match
 */
function parseSet(set: string): Comparator[] {
  const tokens = set
    .replace(/(>=|<=|>|<|=|\^|~)\s+/g, "$1")
    .split(/\s+/)
    .filter(Boolean);
  const [from, dash, to] = tokens;
  if (tokens.length === 3 && from !== undefined && dash === "-" && to !== undefined) {
    const full = parsePartial(to).parts.length === 3;
    const upper = full ? toComparators(`<=${to}`) : toComparators(to).slice(1);
    return [...toComparators(`>=${from}`), ...upper];
  }
  return tokens.flatMap(toComparators);
}

/**
 * Tells whether the result of a comparison fulfills an operator.
 *
 * @param op - The operator
 * @param diff - The result of {@link compareVersions}: negative, 0 or positive
 * @returns Whether the compared version fulfills the operator
 */
function fulfills(op: Operator, diff: number): boolean {
  switch (op) {
    case ">=":
      return diff >= 0;
    case ">":
      return diff > 0;
    case "<=":
      return diff <= 0;
    case "<":
      return diff < 0;
  }
}

/**
 * Tells whether a released version is in a range of the form that `engines.node`
 * uses, for example `^20.19.0 || >=22.12.0`.
 *
 * @param version - The version, for example `24.0.0`
 * @param range - The range
 * @returns Whether the version is in the range
 * @throws An {@link Error} if the range has an unknown form
 */
export function satisfies(version: string, range: string): boolean {
  const v = parseVersion(version);
  return range
    .split("||")
    .some((set) => parseSet(set.trim()).every(({ op, version: bound }) => fulfills(op, compareVersions(v, bound))));
}

/**
 * Finds the highest version with the given major version. Pre-releases are ignored.
 *
 * @param versions - The versions
 * @param major - The major version
 * @returns The highest version, if any
 * @example
 * ```typescript
 * latestOfMajor(["24.12.0", "24.19.2", "26.6.5"], 24); // "24.19.2"
 * ```
 */
export function latestOfMajor(versions: string[], major: number): string | undefined {
  return versions
    .filter(isVersion)
    .map(parseVersion)
    .filter(([ma]) => ma === major)
    .sort(compareVersions)
    .pop()
    ?.join(".");
}
