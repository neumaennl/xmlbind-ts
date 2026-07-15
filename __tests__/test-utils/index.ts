/**
 * Test utilities and helpers for xmlbind-ts tests.
 */

export { withTmpDir } from "./temp-dir.ts";
export {
  setupGeneratedRuntime,
  loadGeneratedClasses,
} from "./generated-runtime.ts";
export { expectStringsOnConsecutiveLines, expectStringsOnSameLine } from "./assertions.ts";
