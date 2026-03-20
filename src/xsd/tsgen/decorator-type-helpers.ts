import { toDecoratorType, requiresRuntimeTypeCoercion } from "./types";
import type { GeneratorState } from "./codegen";

/**
 * Matches union type alias definitions that include a primitive that requires
 * runtime coercion: `number` or `boolean`.
 */
const COERCIBLE_PRIMITIVE_RE = /\b(number|boolean)\b/;
/**
 * Extracts the type expression from a stored type alias definition string.
 * e.g. `'export type allNNI = number | "unbounded";'` → `'number | "unbounded"'`
 * Import lines before the `export type` line are ignored.
 */
function extractTypeExpression(typeDef: string): string | undefined {
  const match = /=\s*(.+?)\s*;?\s*$/.exec(typeDef.replace(/\r?\n/g, " "));
  return match?.[1];
}

/**
 * Determines whether the `allowStringFallback` option should be emitted for
 * the given TypeScript type.  Returns true when the type is a union type alias
 * that includes `number` (or `boolean`) as a member **and** also includes at
 * least one non-coercible member (a string literal, `string`, enum reference,
 * etc.) — e.g. `allNNI = number | "unbounded"`.
 *
 * Returns false for:
 * - Non-union aliases such as `type Foo = number` or `type Bar = number[]`.
 * - Unions whose members are exclusively `number`/`boolean` (no fallback needed).
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
  if (!typeDef) return false;
  // Must be a union type (contains `|`)
  if (!/\|/.test(typeDef)) return false;
  // Must contain a coercible primitive
  if (!COERCIBLE_PRIMITIVE_RE.test(typeDef)) return false;
  // Must also have at least one non-coercible member so the fallback is meaningful.
  const typeExpr = extractTypeExpression(typeDef);
  if (!typeExpr) return false;
  const members = typeExpr.split("|").map((m) => m.trim());
  return members.some((m) => m !== "number" && m !== "boolean");
}

/**
 * Determines the JavaScript constructor name to include as `type` in a
 * generated decorator (`@XmlAttribute` or `@XmlElement`), based on the
 * resolved TypeScript type and the full generator state.
 *
 * - Primitive types (`number`, `boolean`, `Date`) map to `Number`, `Boolean`, `Date`.
 * - Union type aliases whose definition includes `number` but not `boolean`
 *   (e.g. `allNNI = number | "unbounded"`) get `Number`.
 * - Union type aliases whose definition includes `boolean` but not `number`
 *   (e.g. `boolOrAuto = boolean | "auto"`) get `Boolean`.
 * - Non-union aliases that are exactly `= Date` (e.g. a restriction of `xs:date`)
 *   get `Date`.
 * - Mixed unions containing both `number` and `boolean`, or `Date` mixed with
 *   other types, get `undefined` so no single-type coercion is applied at runtime.
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
  if (!typeDef) return undefined;

  const hasNumber = /\bnumber\b/.test(typeDef);
  const hasBoolean = /\bboolean\b/.test(typeDef);
  const hasDate = /\bDate\b/.test(typeDef);

  // Return a type hint only when exactly one coercible primitive is present.
  // Mixed aliases (e.g. `number | boolean`, `Date | number`) get undefined so
  // no single-type coercion is applied at runtime.
  if (hasNumber && !hasBoolean && !hasDate) return "Number";
  if (hasBoolean && !hasNumber && !hasDate) return "Boolean";
  if (hasDate && !hasNumber && !hasBoolean) {
    // Only emit Date for an alias that is purely `= Date` (no union, no array).
    // For `Date | string` unions, skip coercion since no safe fallback exists.
    const typeExpr = extractTypeExpression(typeDef);
    return typeExpr?.trim() === "Date" ? "Date" : undefined;
  }
  return undefined;
}
