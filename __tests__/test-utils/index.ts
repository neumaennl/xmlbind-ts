/**
 * Test utilities and helpers for xmlbind-ts tests.
 */

export { withTmpDir } from "./temp-dir.js";
export {
  setupGeneratedRuntime,
  loadGeneratedClasses,
} from "./generated-runtime.js";
export { expectStringsOnConsecutiveLines, expectStringsOnSameLine } from "./assertions.js";
