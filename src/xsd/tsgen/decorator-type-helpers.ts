import { toDecoratorType, requiresRuntimeTypeCoercion } from "./types";
import type { GeneratorState } from "./codegen";

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
 * the given TypeScript type.  Returns true only when `computeDecoratorType`
 * would emit `Number` or `Boolean` **and** the alias is a union that also
 * contains at least one non-coercible member (a string literal, `string`,
 * enum reference, etc.) — e.g. `allNNI = number | "unbounded"`.
 *
 * This ties fallback emission directly to type-hint emission: if no `type`
 * option is being generated (e.g. mixed `number | boolean`, `Date | string`,
 * or list aliases), `allowStringFallback` is never emitted either.
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
  const decoratorType = computeDecoratorType(tsType, state);
  // Only emit allowStringFallback when a coercible type hint is being emitted
  // for Number or Boolean.  Date doesn't use string fallback semantics.
  if (decoratorType !== "Number" && decoratorType !== "Boolean") return false;

  const typeDef = state.generatedEnums.get(tsType);
  if (!typeDef) return false;
  const typeExpr = extractTypeExpression(typeDef);
  if (!typeExpr) return false;
  const members = typeExpr.split("|").map((m) => m.trim());
  // Must be a union with at least one non-coercible member.
  // A plain `type Foo = number` (single member) doesn't need fallback.
  if (members.length <= 1) return false;
  return members.some((m) => m !== "number" && m !== "boolean");
}

/**
 * Determines the JavaScript constructor name to include as `type` in a
 * generated decorator (`@XmlAttribute` or `@XmlElement`), based on the
 * resolved TypeScript type and the full generator state.
 *
 * - Primitive types (`number`, `boolean`, `Date`) map to `Number`, `Boolean`, `Date`.
 * - Non-union aliases that are exactly `= number`, `= boolean`, or `= Date`
 *   (e.g. a restriction of a numeric or date XSD type) get the corresponding
 *   constructor.
 * - Union aliases: exactly one coercible primitive member must be present and
 *   it must be a standalone member (not `number[]`, not mixed `number | boolean`).
 *   `Date` is not emitted for union aliases.
 * - Returns `undefined` when no explicit type hint is needed (e.g. mixed unions,
 *   list aliases, purely string aliases).
 *
 * Matching is done at the member level (splitting on `|`) to avoid false
 * positives from list aliases like `number[]`.
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

  const typeExpr = extractTypeExpression(typeDef);
  if (!typeExpr) return undefined;

  const members = typeExpr.split("|").map((m) => m.trim());

  // Non-union alias (single member): check for exact primitive names only.
  if (members.length === 1) {
    const m = members[0];
    if (m === "number") return "Number";
    if (m === "boolean") return "Boolean";
    if (m === "Date") return "Date";
    return undefined;
  }

  // Union alias: a type hint is only emitted when exactly one coercible
  // primitive is present as a standalone member.  `Date` is intentionally
  // excluded from union handling — only a pure `= Date` alias gets a hint.
  // Mixed aliases like `number | boolean` or `Date | number` return undefined.
  const hasNumberMember = members.includes("number");
  const hasBooleanMember = members.includes("boolean");
  const hasDateMember = members.includes("Date");

  if (hasNumberMember && !hasBooleanMember && !hasDateMember) return "Number";
  if (hasBooleanMember && !hasNumberMember && !hasDateMember) return "Boolean";
  return undefined;
}

