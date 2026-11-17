// The steps after an update of the Node version: install the new version and
// run npm install, lint and the tests with it. Used by node-version.ts.
import type { Interface } from "node:readline/promises";
import { installNode, runWith } from "./node-setup.ts";

/** The terminal interface; only `question()` is used. */
export type Asker = Pick<Interface, "question">;

const STEPS = ["npm install", "npm run lint", "npm test"];

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
 * Offers to install the Node version and run the steps with it. If the user
 * declines, or there is no terminal, it prints the steps instead.
 *
 * @param rl - The terminal interface
 * @param version - The Node version, for example `24.21.0`
 * @returns The exit code: 0 if the steps were only printed or all succeeded, 1 if the Node
 *   version could not be installed, otherwise that of the step that failed
 */
export async function offerSteps(rl: Asker, version: string): Promise<number> {
  if (!(await confirmSteps(rl, version))) {
    printSteps(version);
    return 0;
  }
  return runSteps(version);
}
