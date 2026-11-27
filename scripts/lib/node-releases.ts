// Looks up the Node releases and their schedule, the @types/node versions, and
// the Node versions that the runtime dependencies accept. Used by node-version.ts.

import { compareVersions, isVersion, latestOfMajor, parseVersion, satisfies } from "./versions.ts";

/** A release line of Node as the Node release schedule lists it. */
interface ReleaseLine {
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

/** How serious a problem is: a warning, or an error that fails the check. */
export type Severity = "warning" | "error";

/** How close a release line is to its end of life. */
export interface EndOfLife {
  end?: string;
  days?: number;
  level: "ok" | Severity;
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
const REQUIRE_ESM: Constraint = { name: "require() of ES modules", range: "^20.19.0 || >=22.12.0" };

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
 * @throws An {@link Error} if a range has an unknown form, naming the constraint
 */
function violated(major: number, constraints: Constraint[]): Constraint[] {
  return constraints.filter((c) => {
    try {
      return !satisfies(`${major}.0.0`, c.range);
    } catch (error) {
      throw new Error(`${c.name}: cannot read the Node range "${c.range}" (${(error as Error).message})`, {
        cause: error,
      });
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
  return list
    .map((e) => `Node ${e.version} by ${e.excludedBy.map((c) => `${c.name} (${c.range})`).join(", ")}`)
    .join("; ");
}

/**
 * Describes the state of a release line on a day.
 *
 * @param line - The release line
 * @param today - The day as `YYYY-MM-DD`
 * @returns `Planned`, `Current`, `Active LTS`, `Maintenance LTS`, `Maintenance` or `End of life`
 */
function lineStatus(line: ReleaseLine, today: string): string {
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
 * @throws An {@link Error} if the request fails
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
async function loadTypesNode(): Promise<string[]> {
  const accept = { Accept: "application/vnd.npm.install-v1+json" };
  return Object.keys((await downloadJson<NpmDocument>(SOURCES.npmPackage("@types/node"), accept)).versions);
}

/**
 * Downloads the released Node versions.
 *
 * @returns The versions without `v`, oldest first
 */
async function loadReleases(): Promise<string[]> {
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
