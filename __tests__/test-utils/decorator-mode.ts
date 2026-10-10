import { inject } from "vitest";

export type DecoratorMode = "legacy" | "stage3";

declare module "vitest" {
  export interface ProvidedContext {
    decoratorMode: DecoratorMode;
  }
}

/**
 * The decorator mode of the current Vitest project (see vitest.config.mts).
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
 */
export function detectDecoratorMode(): DecoratorMode {
  let detected: DecoratorMode | undefined;
  function probe(_target: unknown, contextOrKey: unknown): void {
    detected = typeof contextOrKey === "object" ? "stage3" : "legacy";
  }
  class Probe {
    @probe
    value?: string;
  }
  void Probe;
  if (detected === undefined) throw new Error("Probe decorator was not called");
  return detected;
}
