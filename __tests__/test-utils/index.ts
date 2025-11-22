/**
 * Test utilities and helpers for xmlbind-ts tests.
 */

export { withTmpDir } from "./temp-dir";
export {
  setupGeneratedRuntime,
  loadGeneratedClasses,
} from "./generated-runtime";
export { expectStringsOnConsecutiveLines, expectStringsOnSameLine } from "./assertions";
