/**
 * Test utilities and helpers for xmlbind-ts tests.
 */

export { withTmpDir } from "./temp-dir.js";
export { compilerTarget } from "./compiler-target.js";
export type { CompilerTarget } from "./compiler-target.js";
export {
  setupGeneratedRuntime,
  loadGeneratedClasses,
} from "./generated-runtime.js";
export { expectStringsOnConsecutiveLines, expectStringsOnSameLine } from "./assertions.js";
export {
  decoratorMode,
  emitsDecoratorMetadata,
  detectDecoratorMode,
} from "./decorator-mode.js";
export type { DecoratorMode } from "./decorator-mode.js";
