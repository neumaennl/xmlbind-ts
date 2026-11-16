// fallow-ignore-file unused-file -- the tests of version 3 will use it; remove this comment when one does

import { inject } from "vitest";

export type DecoratorMode = "legacy" | "stage3";

declare module "vitest" {
  export interface ProvidedContext {
    decoratorMode: DecoratorMode;
  }
}

/**
 * The decorator mode of the current Vitest project (see `vitest.config.ts`).
 */
export const decoratorMode: DecoratorMode = inject("decoratorMode");

/**
 * Whether the compiler emits `design:type` metadata, which only happens with
 * legacy decorators and `emitDecoratorMetadata`.
 */
export const emitsDecoratorMetadata = decoratorMode === "legacy";

/**
 * Detects how decorators were actually compiled, by checking whether a field
 * decorator receives a Stage 3 context object or a legacy property key.
 *
 * @returns The decorator mode that the compiler used
 * @throws An {@link Error} if the compiler did not call the decorator
 */
export function detectDecoratorMode(): DecoratorMode {
  let detected: DecoratorMode | undefined;
  /**
   * Records the decorator mode from the arguments that the decorator receives.
   *
   * @param _target - The class prototype (legacy) or undefined (Stage 3)
   * @param contextOrKey - The context object (Stage 3) or the property key (legacy)
   */
  function probe(_target: unknown, contextOrKey: unknown): void {
    detected = typeof contextOrKey === "object" ? "stage3" : "legacy";
  }
  /**
   * Declared only so that the compiler calls its decorator. The leading _
   * keeps `@typescript-eslint/no-unused-vars` from reporting the unused class.
   */
  class _Probe {
    @probe
    value?: string;
  }
  if (detected === undefined) throw new Error("Probe decorator was not called");
  return detected;
}
