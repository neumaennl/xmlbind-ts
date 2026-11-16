// fallow-ignore-file unused-file -- the tests of version 3 will use it; remove this comment when one does

/**
 * Test utilities and helpers for xmlbind-ts tests.
 */

export { withTmpDir } from "./temp-dir.js";
export { compilerTarget } from "./compiler-target.js";
export type { CompilerTarget } from "./compiler-target.js";
export { expectStringsOnConsecutiveLines, expectStringsOnSameLine } from "./assertions.js";
export {
  decoratorMode,
  emitsDecoratorMetadata,
  detectDecoratorMode,
} from "./decorator-mode.js";
export type { DecoratorMode } from "./decorator-mode.js";
