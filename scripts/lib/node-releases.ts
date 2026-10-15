// Looks up the Node releases and their schedule, the @types/node versions, and
// the Node versions that the runtime dependencies accept. Used by node-version.ts.

/** A parsed version: major, minor and patch. */
export type Version = [number, number, number];

/** A release line of Node as the Node release schedule lists it. */
export interface ReleaseLine {
  start: string;
  lts?: string;
  maintenance?: string;
  end: string;
  codename?: string;
}

/** The Node release schedule, keyed by `v` and the major version, for example `v24`. */
export type Schedule = Record<string, ReleaseLine>;

/** A range of Node versions that something requires, for example a dependency. */
export interface Constraint {
  name: string;
  range: string;
}

/** The lookup data from the internet. */
export interface NodeData {
  schedule: Schedule;
  /** The released Node versions, oldest first. */
  releases: string[];
  /** The published versions of `@types/node`. */
  typesNode: string[];
}

/** How close a release line is to its end of life. */
export interface EndOfLife {
  end?: string;
  days?: number;
  level: "ok" | "warning" | "error";
}

/** A version that `>=major` includes but runtime dependencies exclude. */
export interface Exclusion {
  version: string;
  excludedBy: Constraint[];
}

/** A release line with what matters for choosing it. */
export interface LineRow {
  major: number;
  status: string;
  /** The versions that `>=major` includes but the constraints exclude. */
  exclusions: Exclusion[];
  /** The `@types/node` range for the line. */
  typesNode?: string;
  latest: string;
  end: string;
}

/** The days before the end of life of a Node version from which `check` warns. */
export const WARN_DAYS = 90;

/**
 * The library is an ES module only. CommonJS consumers load it with `require()`,
 * which Node supports without a flag from these versions on.
 */
export const REQUIRE_ESM: Constraint = { name: "require() of ES modules", range: "^20.19.0 || >=22.12.0" };

interface NodeIndexEntry {
  version: string;
}

interface NpmDocument {
  versions: Record<string, object>;
}

/** The parts of `package-lock.json` that are read. */
export interface PackageLock {
  packages: Record<string, { version?: string; dev?: boolean; devOptional?: boolean; engines?: unknown }>;
}

const SOURCES = {
  nodeSchedule: "https://raw.githubusercontent.com/nodejs/Release/main/schedule.json",
  nodeIndex: "https://nodejs.org/dist/index.json",
  npmPackage: (name: string): string => `https://registry.npmjs.org/${name.replace("/", "%2f")}`,
};

/**
 * Parses a version like `24.15.0`, optionally prefixed with `v`.
 *
 * @param text - The version
 * @returns Major, minor and patch
 * @throws {Error} If the text is not a version
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

/**
 * Reads the major version from `engines.node`.
 *
 * @param engines - The value of `engines.node`, which must have the form `>=24`
 * @returns The major version, or undefined if the value has another form
 */
export function enginesMajor(engines: string | undefined): number | undefined {
  const match = /^>=\s*(\d+)$/.exec(engines?.trim() ?? "");
  return match ? Number(match[1]) : undefined;
}

/**
 * Reads the major version from the `@types/node` range.
 *
 * @param range - The range, which must have the form `^24.19.2`
 * @returns The major version, or undefined if the range has another form
 */
export function typesNodeMajor(range: string | undefined): number | undefined {
  const match = /^\^(\d+)\.\d+\.\d+$/.exec(range?.trim() ?? "");
  return match ? Number(match[1]) : undefined;
}

type Operator = ">=" | ">" | "<=" | "<" | "=";

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
 * @throws {Error} If the text is not a partial version
 */
function parsePartial(text: string): { parts: number[]; pre: boolean } {
  const match = /^v?(\d+|[xX*])?(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*])(-[0-9A-Za-z.-]+)?)?(?:\+[0-9A-Za-z.-]+)?$/.exec(text);
  if (!match) {
    throw new Error(`Not a version: "${text}"`);
  }
  const parts: number[] = [];
  for (const part of match.slice(1, 4)) {
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
  const [, op = "", rest] = /^(>=|<=|>|<|=|\^|~)?(.*)$/.exec(token) ?? [];
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
      return [{ op: ">=", version: lower }, { op: "<", version: nextOf(Math.min(parts.length, 2)) }];
    case "^": {
      const significant = a > 0 ? 1 : b > 0 ? 2 : parts.length;
      return [{ op: ">=", version: lower }, { op: "<", version: nextOf(significant) }];
    }
    default:
      return pre ? none : [{ op: ">=", version: lower }, { op: "<", version: next }];
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
  const tokens = set.replace(/(>=|<=|>|<|=|\^|~)\s+/g, "$1").split(/\s+/).filter(Boolean);
  if (tokens.length === 3 && tokens[1] === "-") {
    const full = parsePartial(tokens[2]).parts.length === 3;
    const upper = full ? toComparators(`<=${tokens[2]}`) : toComparators(tokens[2]).slice(1);
    return [...toComparators(`>=${tokens[0]}`), ...upper];
  }
  return tokens.flatMap(toComparators);
}

/**
 * Tells whether a released version is in a range of the form that `engines.node`
 * uses, for example `^20.19.0 || >=22.12.0`.
 *
 * @param version - The version, for example `24.0.0`
 * @param range - The range
 * @returns Whether the version is in the range
 * @throws {Error} If the range has an unknown form
 */
export function satisfies(version: string, range: string): boolean {
  const v = parseVersion(version);
  return range.split("||").some((set) =>
    parseSet(set.trim()).every(({ op, version: bound }) => {
      const diff = compareVersions(v, bound);
      return op === ">=" ? diff >= 0 : op === ">" ? diff > 0 : op === "<=" ? diff <= 0 : op === "<" ? diff < 0 : diff === 0;
    }),
  );
}

/**
 * Finds the highest version with the given major version. Pre-releases are ignored.
 *
 * @param versions - The versions
 * @param major - The major version
 * @returns The highest version, if any
 * @example
 * latestOfMajor(["24.12.0", "24.19.2", "26.6.5"], 24); // "24.19.2"
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

/**
 * Returns the `@types/node` range for a major version of Node: `^` and the
 * latest published version with that major version.
 *
 * @param major - The major version of Node
 * @param typesNode - The published versions of `@types/node`
 * @returns The range, for example `^24.19.2`, or undefined if there is none
 */
export function typesNodeRange(major: number, typesNode: string[]): string | undefined {
  const latest = latestOfMajor(typesNode, major);
  return latest && `^${latest}`;
}

/**
 * Collects the Node ranges that the runtime dependencies require, from
 * `package-lock.json`, and adds the range for `require()` of ES modules.
 *
 * @param lock - The parsed `package-lock.json`
 * @returns The constraints
 */
export function runtimeConstraints(lock: PackageLock): Constraint[] {
  const constraints: Constraint[] = [];
  for (const [path, entry] of Object.entries(lock.packages)) {
    const engines = entry.engines as { node?: unknown } | undefined;
    if (!path || entry.dev || entry.devOptional || typeof engines?.node !== "string") {
      continue;
    }
    const name = path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
    constraints.push({ name: `${name} ${entry.version ?? ""}`.trim(), range: engines.node });
  }
  return [...constraints, REQUIRE_ESM];
}

/**
 * Returns the constraints that exclude the first version of a major version.
 *
 * @param major - The major version of Node
 * @param constraints - The constraints
 * @returns The violated constraints
 * @throws {Error} If a range has an unknown form, naming the constraint
 */
export function violated(major: number, constraints: Constraint[]): Constraint[] {
  return constraints.filter((c) => {
    try {
      return !satisfies(`${major}.0.0`, c.range);
    } catch (error) {
      throw new Error(`${c.name}: cannot read the Node range "${c.range}" (${(error as Error).message})`, { cause: error });
    }
  });
}

/**
 * Lists the release lines that have started and not reached their end of life.
 *
 * @param schedule - The Node release schedule
 * @param today - The day as `YYYY-MM-DD`
 * @returns The major versions, lowest first
 */
export function supportedLines(schedule: Schedule, today: string): number[] {
  return Object.entries(schedule)
    .filter(([key, line]) => /^v\d+$/.test(key) && line.start <= today && today < line.end)
    .map(([key]) => Number(key.slice(1)))
    .sort((a, b) => a - b);
}

/**
 * Finds the versions that `>=major` includes but a constraint excludes: the first
 * version of the major version and of every newer line before its end of life.
 * Lines past their end of life are left out, because no one should use them.
 *
 * @param major - The major version of Node
 * @param schedule - The Node release schedule
 * @param constraints - The constraints
 * @param today - The day as `YYYY-MM-DD`
 * @returns One entry per excluded version, lowest first
 */
export function exclusions(major: number, schedule: Schedule, constraints: Constraint[], today: string): Exclusion[] {
  return [major, ...supportedLines(schedule, today).filter((m) => m > major)]
    .map((m) => ({ version: `${m}.0.0`, excludedBy: violated(m, constraints) }))
    .filter((e) => e.excludedBy.length > 0);
}

/**
 * Describes exclusions for a message.
 *
 * @param list - The exclusions
 * @returns For example `Node 26.0.0 by foo 1.0.0 (>=24 <26)`
 */
export function describeExclusions(list: Exclusion[]): string {
  return list.map((e) => `Node ${e.version} by ${e.excludedBy.map((c) => `${c.name} (${c.range})`).join(", ")}`).join("; ");
}

/**
 * Describes the state of a release line on a day.
 *
 * @param line - The release line
 * @param today - The day as `YYYY-MM-DD`
 * @returns `Planned`, `Current`, `Active LTS`, `Maintenance LTS`, `Maintenance` or `End of life`
 */
export function lineStatus(line: ReleaseLine, today: string): string {
  if (today < line.start) {
    return "Planned";
  }
  if (today >= line.end) {
    return "End of life";
  }
  const inMaintenance = line.maintenance !== undefined && today >= line.maintenance;
  if (line.lts && today >= line.lts) {
    return inMaintenance ? "Maintenance LTS" : "Active LTS";
  }
  return inMaintenance ? "Maintenance" : "Current";
}

/**
 * Counts the days from one day to another.
 *
 * @param from - The first day as `YYYY-MM-DD`
 * @param to - The second day as `YYYY-MM-DD`
 * @returns The number of days, negative if `to` is earlier
 */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

/**
 * Tells how close a release line is to its end of life.
 *
 * @param major - The major version of Node
 * @param schedule - The Node release schedule
 * @param today - The day as `YYYY-MM-DD`
 * @returns `error` from the end of life on (or if the line is unknown), `warning`
 *   in the {@link WARN_DAYS} days before, and `ok` otherwise
 */
export function endOfLife(major: number, schedule: Schedule, today: string): EndOfLife {
  const end = schedule[`v${major}`]?.end;
  if (!end) {
    return { level: "error" };
  }
  const days = daysBetween(today, end);
  return { end, days, level: days <= 0 ? "error" : days <= WARN_DAYS ? "warning" : "ok" };
}

/**
 * Lists the release lines that are released and not past their end of life.
 *
 * @param data - The lookup data
 * @param constraints - The constraints of the runtime dependencies
 * @param today - The day as `YYYY-MM-DD`
 * @returns One row per release line, oldest first
 */
export function listLines(data: NodeData, constraints: Constraint[], today: string): LineRow[] {
  const rows: LineRow[] = [];
  for (const [key, line] of Object.entries(data.schedule)) {
    const major = Number(key.slice(1));
    const status = lineStatus(line, today);
    const latest = latestOfMajor(data.releases, major);
    if (!/^v\d+$/.test(key) || status === "Planned" || status === "End of life" || !latest) {
      continue;
    }
    rows.push({
      major,
      status,
      exclusions: exclusions(major, data.schedule, constraints, today),
      typesNode: typesNodeRange(major, data.typesNode),
      latest,
      end: line.end,
    });
  }
  return rows.sort((a, b) => a.major - b.major);
}

/**
 * Finds the newest LTS line that has a release.
 *
 * @param data - The lookup data
 * @param today - The day as `YYYY-MM-DD`
 * @returns The major version, if there is an LTS line
 */
export function newestLts(data: NodeData, today: string): number | undefined {
  return Object.entries(data.schedule)
    .filter(([key, line]) => /^v\d+$/.test(key) && line.lts && today >= line.lts && today < line.end)
    .map(([key]) => Number(key.slice(1)))
    .filter((major) => latestOfMajor(data.releases, major))
    .sort((a, b) => b - a)[0];
}

/**
 * Fetches a URL and parses its body as JSON.
 *
 * @param url - The URL
 * @param headers - Additional request headers
 * @returns The parsed body
 * @throws {Error} If the request fails
 */
async function downloadJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

/**
 * Downloads the Node release schedule.
 *
 * @returns The schedule
 */
export function loadSchedule(): Promise<Schedule> {
  return downloadJson<Schedule>(SOURCES.nodeSchedule);
}

/**
 * Downloads the published versions of `@types/node`.
 *
 * @returns The versions
 */
export async function loadTypesNode(): Promise<string[]> {
  const accept = { Accept: "application/vnd.npm.install-v1+json" };
  return Object.keys((await downloadJson<NpmDocument>(SOURCES.npmPackage("@types/node"), accept)).versions);
}

/**
 * Downloads the released Node versions.
 *
 * @returns The versions without `v`, oldest first
 */
export async function loadReleases(): Promise<string[]> {
  const index = await downloadJson<NodeIndexEntry[]>(SOURCES.nodeIndex);
  return index
    .map((r) => r.version.replace(/^v/, ""))
    .filter(isVersion)
    .sort((a, b) => compareVersions(parseVersion(a), parseVersion(b)));
}

/**
 * Downloads all lookup data.
 *
 * @returns The lookup data
 */
export async function loadData(): Promise<NodeData> {
  const [schedule, releases, typesNode] = await Promise.all([loadSchedule(), loadReleases(), loadTypesNode()]);
  return { schedule, releases, typesNode };
}
