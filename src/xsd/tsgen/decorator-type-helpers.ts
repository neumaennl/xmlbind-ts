import { toDecoratorType, requiresRuntimeTypeCoercion } from "./types";
import type { GeneratorState } from "./codegen";

/**
 * Matches union type alias definitions that include a primitive that requires
 * runtime coercion: `number` or `boolean`.
 */
const COERCIBLE_PRIMITIVE_RE = /\b(number|boolean)\b/;

/**
 * Determines whether the `allowStringFallback` option should be emitted for
 * the given TypeScript type.  Returns true when the type is a union type alias
 * that includes `number` (or `boolean`) as a member — e.g.
 * `allNNI = number | "unbounded"` — so that non-numeric strings like
 * `"unbounded"` pass through as-is rather than coercing to `NaN`.
 *
 * Used by both attribute and element decorator emission.
 *
 * @param tsType - The resolved TypeScript type name
 * @param state - The generator state (used to look up generated type aliases)
 */
export function needsAllowStringFallback(
  tsType: string,
  state: GeneratorState
): boolean {
  const typeDef = state.generatedEnums.get(tsType);
  return typeDef !== undefined && COERCIBLE_PRIMITIVE_RE.test(typeDef);
}

/**
 * Determines the JavaScript constructor name to include as `type` in a
 * generated decorator (`@XmlAttribute` or `@XmlElement`), based on the
 * resolved TypeScript type and the full generator state.
 *
 * - Primitive types (`number`, `boolean`, `Date`) map to `Number`, `Boolean`, `Date`.
 * - Union type aliases whose definition includes `number` (e.g. `allNNI = number | "unbounded"`)
 *   also get `Number` so the unmarshaller applies numeric coercion; the accompanying
 *   `allowStringFallback: true` option (emitted separately) ensures non-numeric strings
 *   pass through unchanged.
 * - Returns `undefined` when no explicit type hint is needed.
 *
 * Used by both attribute and element decorator emission.
 *
 * @param tsType - The resolved TypeScript type name
 * @param state - The generator state (used to look up generated type aliases)
 */
export function computeDecoratorType(
  tsType: string,
  state: GeneratorState
): string | undefined {
  if (requiresRuntimeTypeCoercion(tsType)) {
    return toDecoratorType(tsType);
  }
  const typeDef = state.generatedEnums.get(tsType);
  if (typeDef && COERCIBLE_PRIMITIVE_RE.test(typeDef)) {
    return /\bnumber\b/.test(typeDef) ? "Number" : "Boolean";
  }
  return undefined;
}
