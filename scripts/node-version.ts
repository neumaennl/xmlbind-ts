// Keeps the supported Node major version in line in `engines.node`,
// `@types/node` and `.nvmrc`, with the runtime dependencies, and with the Node
// release schedule. Development and CI use the latest release of that major
// version.
//
//   node scripts/node-version.ts update [major]
//     Shows the Node release lines with their status, whether the runtime
//     dependencies accept them, the matching @types/node and their end of life,
//     asks for the major version (unless given), updates `package.json` and
//     `.nvmrc`, and then installs the latest release of that major version (with
//     nvm, nvm-windows or fnm) and runs npm install, lint and the tests with it.
//   node scripts/node-version.ts check [--strict]
//     Fails if @types/node or .nvmrc don't match engines.node, if a runtime
//     dependency excludes a version that engines.node includes, or if the Node
//     version has reached its end of life; warns in the 90 days before. With
//     --strict, a warning fails as well.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface, type Interface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
import { installNode, runWith } from "./lib/node-setup.ts";
import {
  describeExclusions,
  endOfLife,
  enginesMajor,
  exclusions,
  latestOfMajor,
  listLines,
  loadData,
  loadSchedule,
  newestLts,
  runtimeConstraints,
  typesNodeMajor,
  typesNodeRange,
  WARN_DAYS,
  type Constraint,
  type LineRow,
  type NodeData,
  type PackageLock,
  type Schedule,
} from "./lib/node-releases.ts";

/** The terminal interface; only `question()` is used. */
type Asker = Pick<Interface, "question">;

/** The parts of `package.json` that the script reads and writes. */
export interface PackageJson {
  engines?: { node?: string };
  devDependencies: Record<string, string>;
}

/** `package.json` as read from disk, with its line endings. */
export interface Manifest {
  pkg: PackageJson;
  crlf: boolean;
}

/** The values that the script writes. */
export interface Values {
  major: number;
  typesNode: string;
}

/** The current state of the project. */
interface Current extends Manifest {
  engines?: string;
  typesNode?: string;
  nvmrc?: string;
  constraints: Constraint[];
}

const STEPS = ["npm install", "npm run lint", "npm test"];

/**
 * Formats rows as a text table with aligned columns.
 *
 * @param header - The column titles
 * @param rows - The cells
 * @returns The table
 */
export function formatTable(header: string[], rows: string[][]): string {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells: string[]): string => cells.map((c, i) => c.padEnd(widths[i])).join("  ").trimEnd();
  return [line(header), line(widths.map((w) => "-".repeat(w))), ...rows.map(line)].join("\n");
}

/**
 * Reads a file, or returns undefined if it does not exist.
 *
 * @param path - The path
 * @returns The content
 */
function readOptional(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

/**
 * Reads `package.json`, `.nvmrc` and the runtime dependencies from `package-lock.json`.
 *
 * @param dir - The folder that contains the files
 * @returns The current state
 */
function readCurrent(dir: string): Current {
  const text = readFileSync(join(dir, "package.json"), "utf8");
  const pkg = JSON.parse(text) as PackageJson;
  const lock = JSON.parse(readFileSync(join(dir, "package-lock.json"), "utf8")) as PackageLock;
  return {
    pkg,
    crlf: text.includes("\r\n"),
    engines: pkg.engines?.node,
    typesNode: pkg.devDependencies["@types/node"],
    nvmrc: readOptional(join(dir, ".nvmrc"))?.trim(),
    constraints: runtimeConstraints(lock),
  };
}

/**
 * Returns today's date in UTC.
 *
 * @returns The date as `YYYY-MM-DD`
 */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Describes the end of life of a release line, if it matters.
 *
 * @param major - The major version of Node
 * @param schedule - The Node release schedule
 * @param today - The day as `YYYY-MM-DD`
 * @returns The level and the message, or undefined if the end of life is far away
 */
function endOfLifeMessage(major: number, schedule: Schedule, today: string): { level: "warning" | "error"; text: string } | undefined {
  const eol = endOfLife(major, schedule, today);
  if (eol.level === "ok") {
    return undefined;
  }
  if (!eol.end || eol.days === undefined) {
    return { level: "error", text: `Node ${major} is not in the Node release schedule.` };
  }
  return eol.level === "error"
    ? { level: "error", text: `Node ${major} reached its end of life on ${eol.end}.` }
    : { level: "warning", text: `Node ${major} reaches its end of life on ${eol.end}, in ${eol.days} days.` };
}

/**
 * Prints a problem or a warning, as an annotation when running in GitHub Actions.
 *
 * @param level - `error` or `warning`
 * @param text - The message
 */
function report(level: "warning" | "error", text: string): void {
  if (process.env.GITHUB_ACTIONS === "true") {
    console.log(`::${level}::${text}`);
  } else if (level === "error") {
    console.error(text);
  } else {
    console.warn(`Warning: ${text}`);
  }
}

/**
 * Checks that `@types/node` and `.nvmrc` match `engines.node`, that the runtime
 * dependencies accept the versions that `engines.node` includes, and that the
 * Node version has not reached its end of life.
 *
 * @param dir - The folder with `package.json`, `package-lock.json` and `.nvmrc`
 * @param today - The day as `YYYY-MM-DD`
 * @param strict - Whether a near end of life fails the check, too
 * @returns The exit code: 0 if everything matches, 1 otherwise
 */
export async function check(dir = ".", today = todayUtc(), strict = false): Promise<number> {
  const current = readCurrent(dir);
  const major = enginesMajor(current.engines);
  if (major === undefined) {
    report("error", `engines.node: is "${current.engines ?? ""}", expected ">=" and a major version, for example ">=24".`);
    console.error("Run `npm run node:update` to fix this.");
    return 1;
  }
  const problems: string[] = [];
  const warnings: string[] = [];
  if (typesNodeMajor(current.typesNode) !== major) {
    problems.push(`@types/node: is "${current.typesNode ?? ""}", expected "^${major}.x.y".`);
  }
  if (current.nvmrc !== String(major)) {
    problems.push(`.nvmrc: is "${current.nvmrc ?? ""}", expected "${major}".`);
  }
  const schedule = await loadSchedule();
  const excluded = exclusions(major, schedule, current.constraints, today);
  if (excluded.length > 0) {
    problems.push(`engines.node >=${major} includes versions that runtime dependencies exclude: ${describeExclusions(excluded)}.`);
  }
  const message = endOfLifeMessage(major, schedule, today);
  if (message) {
    (message.level === "error" || strict ? problems : warnings).push(message.text);
  }
  console.log(`Supported Node version: ${major} (engines.node ${current.engines}).`);
  for (const text of warnings) {
    report("warning", text);
  }
  for (const text of problems) {
    report("error", text);
  }
  if (problems.length > 0) {
    console.error("Run `npm run node:update` to fix this.");
    return 1;
  }
  if (warnings.length > 0) {
    console.log("Raise the Node version with `npm run node:update` before the end of life.");
  } else {
    console.log(`engines.node, @types/node, .nvmrc and the runtime dependencies match; Node ${major} does not end within ${WARN_DAYS} days.`);
  }
  return 0;
}

/**
 * Checks whether a major version can be the supported Node version.
 *
 * @param major - The major version of Node
 * @param data - The lookup data
 * @param constraints - The constraints of the runtime dependencies
 * @param today - The day as `YYYY-MM-DD`
 * @returns Why it cannot, or undefined if it can
 */
export function rejectMajor(major: number, data: NodeData, constraints: Constraint[], today: string): string | undefined {
  if (!latestOfMajor(data.releases, major)) {
    return `Node ${major} has no release.`;
  }
  if (endOfLife(major, data.schedule, today).level === "error") {
    return `Node ${major} has reached its end of life or is not in the Node release schedule.`;
  }
  const excluded = exclusions(major, data.schedule, constraints, today);
  if (excluded.length > 0) {
    return `>=${major} would include versions that runtime dependencies exclude: ${describeExclusions(excluded)}.`;
  }
  if (!typesNodeRange(major, data.typesNode)) {
    return `There is no @types/node ${major}.x.`;
  }
  return undefined;
}

/**
 * Parses a major version like `24` or `v24`.
 *
 * @param text - The text
 * @returns The major version, or undefined if the text is not one
 */
function parseMajor(text: string): number | undefined {
  const match = /^v?(\d+)$/.exec(text.trim());
  return match ? Number(match[1]) : undefined;
}

/**
 * Prints the runtime constraints and the table of release lines.
 *
 * @param rows - The release lines
 * @param current - The current state
 */
function printOverview(rows: LineRow[], current: Current): void {
  console.log("\nThe runtime dependencies accept these Node versions:");
  console.log(current.constraints.map((c) => `  ${c.name}: ${c.range}`).join("\n"));
  const header = ["Node", "Status", "Accepted by dependencies", "@types/node", "Latest", "End of life"];
  const cells = rows.map((r) => [
    String(r.major),
    r.status,
    r.exclusions.length === 0
      ? "yes"
      : `no: ${r.exclusions.map((e) => `${e.version} by ${e.excludedBy.map((c) => c.name).join(", ")}`).join("; ")}`,
    r.typesNode ?? "-",
    r.latest,
    r.end,
  ]);
  console.log(`\n${formatTable(header, cells)}\n`);
  console.log("Accepted by dependencies tells whether all of the above accept every version that >=x includes:");
  console.log("the first version of the line (x.0.0) and of every newer line before its end of life.");
  console.log(`Currently: engines.node ${current.engines ?? "-"}, @types/node ${current.typesNode ?? "-"}, .nvmrc ${current.nvmrc ?? "-"}.\n`);
}

/**
 * Asks for the major version until the answer is accepted.
 *
 * @param data - The lookup data
 * @param current - The current state
 * @param today - The day as `YYYY-MM-DD`
 * @param rl - The terminal interface
 * @returns The major version
 */
export async function choose(data: NodeData, current: Current, today: string, rl: Asker): Promise<number> {
  const suggested = newestLts(data, today);
  const prompt = `Node major version${suggested === undefined ? "" : ` [${suggested}]`}: `;
  for (;;) {
    const answer = (await rl.question(prompt)).trim();
    const major = answer ? parseMajor(answer) : suggested;
    const error = major === undefined ? "Enter a major version, for example 24." : rejectMajor(major, data, current.constraints, today);
    if (major !== undefined && !error) {
      return major;
    }
    console.log(error);
  }
}

/**
 * Writes the values into `package.json` and `.nvmrc`, keeping the line endings of
 * `package.json` (Git may check files out with CRLF on Windows).
 *
 * @param manifest - The parsed `package.json` and its line endings
 * @param values - The values to write
 * @param dir - The folder with `package.json` and `.nvmrc`
 */
export function writeValues({ pkg, crlf }: Manifest, values: Values, dir = "."): void {
  const eol = crlf ? "\r\n" : "\n";
  pkg.engines = { ...pkg.engines, node: `>=${values.major}` };
  pkg.devDependencies["@types/node"] = values.typesNode;
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`.replace(/\n/g, eol));
  writeFileSync(join(dir, ".nvmrc"), `${values.major}${eol}`);
}

/**
 * Prints the steps to run after the update.
 *
 * @param version - The Node version to run them with
 */
function printSteps(version: string): void {
  console.log(`Install and use Node ${version}, then run:\n${STEPS.map((s) => `  ${s}`).join("\n")}`);
}

/**
 * Asks whether to install the Node version and run the steps. Without a
 * terminal, it does not ask.
 *
 * @param rl - The terminal interface
 * @param version - The Node version
 * @returns Whether to run the steps
 */
async function confirmSteps(rl: Asker, version: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    return false;
  }
  const answer = await rl.question(`Install Node ${version} and run ${STEPS.join(", ")} now? [Y/n] `);
  return !/^n/i.test(answer.trim());
}

/**
 * Installs the Node version and runs the steps, or prints them if the Node
 * version could not be installed.
 *
 * @param version - The Node version
 * @returns The exit code
 */
function runSteps(version: string): number {
  const folder = installNode(version);
  if (!folder) {
    console.error(`Could not install Node ${version} with nvm, nvm-windows or fnm.`);
    printSteps(version);
    return 1;
  }
  return runWith(folder, STEPS);
}

/**
 * Updates the supported Node major version in `engines.node`, `@types/node` and `.nvmrc`.
 *
 * @param requested - The major version, or undefined to ask
 * @param dir - The folder with `package.json`, `package-lock.json` and `.nvmrc`
 * @param today - The day as `YYYY-MM-DD`
 * @returns The exit code
 * @throws {Error} If no version is given and there is no terminal to ask, or the given version is not accepted
 */
export async function update(requested: string | undefined, dir = ".", today = todayUtc()): Promise<number> {
  if (!requested && !process.stdin.isTTY) {
    throw new Error("Not running in a terminal: give the Node major version, for example `update 24`.");
  }
  const current = readCurrent(dir);
  const data = await loadData();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    let major: number;
    if (requested) {
      const parsed = parseMajor(requested);
      const error = parsed === undefined ? `Not a major version: "${requested}"` : rejectMajor(parsed, data, current.constraints, today);
      if (parsed === undefined || error) {
        throw new Error(error);
      }
      major = parsed;
    } else {
      printOverview(listLines(data, current.constraints, today), current);
      major = await choose(data, current, today, rl);
    }
    const values: Values = { major, typesNode: typesNodeRange(major, data.typesNode) ?? "" };
    writeValues(current, values, dir);
    console.log(`Set engines.node >=${major}, @types/node ${values.typesNode} and .nvmrc ${major}.`);
    const message = endOfLifeMessage(major, data.schedule, today);
    if (message) {
      report(message.level, message.text);
    }
    const latest = latestOfMajor(data.releases, major) ?? String(major);
    if (!(await confirmSteps(rl, latest))) {
      printSteps(latest);
      return 0;
    }
    return runSteps(latest);
  } finally {
    rl.close();
  }
}

/**
 * Runs the command given on the command line.
 *
 * @param args - The command line arguments after the script name
 * @returns The exit code
 */
export async function main(args: string[]): Promise<number> {
  const [command, ...rest] = args;
  if (command === "check" && rest.every((arg) => arg === "--strict")) {
    return check(".", undefined, rest.length > 0);
  }
  if (command === "update" && rest.length <= 1) {
    return update(rest[0]);
  }
  console.error("Usage: node scripts/node-version.ts check [--strict] | update [major]");
  return 2;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: Error) => {
      console.error(error.message);
      process.exit(1);
    },
  );
}
