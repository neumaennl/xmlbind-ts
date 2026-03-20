import type { Element as XmldomElement } from "@xmldom/xmldom";
import { localName } from "./utils";
import { sanitizeTypeName, toDecoratorType, requiresRuntimeTypeCoercion } from "./types";
import type { GeneratorState, GenUnit } from "./codegen";
import { resolveType, toPropertyName, attributeNamespaceFor } from "./codegen";

/**
 * Determines whether the `allowStringFallback` option should be emitted for
 * the given TypeScript type.  Returns true when the type is a union type alias
 * that includes `number` (or `boolean`) as a member — e.g.
 * `allNNI = number | "unbounded"` — so that non-numeric strings like
 * `"unbounded"` pass through as-is rather than coercing to `NaN`.
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
  return /\bnumber\b/.test(typeDef) || /\bboolean\b/.test(typeDef);
}

/**
 * Determines the JavaScript constructor name to include as `type` in the generated
 * `@XmlAttribute(...)` decorator, based on the resolved TypeScript type and the
 * full generator state.
 *
 * - Primitive types (`number`, `boolean`, `Date`) map to `Number`, `Boolean`, `Date`.
 * - Union type aliases whose definition includes `number` (e.g. `allNNI = number | "unbounded"`)
 *   also get `Number` so the unmarshaller applies numeric coercion; the accompanying
 *   `allowStringFallback: true` option (emitted separately) ensures non-numeric strings
 *   pass through unchanged.
 * - Returns `undefined` when no explicit type hint is needed.
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
  // Check if it is a union type alias that includes 'number' as a member.
  // generatedEnums stores entries like: "export type allNNI = number | \"unbounded\";"
  const typeDef = state.generatedEnums.get(tsType);
  if (typeDef && /\bnumber\b/.test(typeDef)) {
    return "Number";
  }
  return undefined;
}

/**
 * Builds the `@XmlAttribute(...)` decorator line for code generation.
 *
 * @param attrName - The XML attribute name
 * @param ans - Optional XML namespace URI for the attribute
 * @param decoratorType - Pre-computed JS constructor name for `{ type: ... }`, or undefined
 * @returns The decorator line string (e.g. `  @XmlAttribute('id', { type: Number })`)
 */
export function buildXmlAttributeDecorator(
  attrName: string,
  ans: string | null | undefined,
  decoratorType: string | undefined
): string {
  const opts: string[] = [];
  if (ans) opts.push(`namespace: '${ans}'`);
  if (decoratorType) opts.push(`type: ${decoratorType}`);

  if (opts.length === 0) {
    return `  @XmlAttribute('${attrName}')`;
  }
  return `  @XmlAttribute('${attrName}', { ${opts.join(", ")} })`;
}

/**
 * Emits a single attribute property with its decorator and type annotation.
 * This is a shared helper to avoid code duplication across multiple attribute emission functions.
 *
 * @param attr - The XSD attribute element
 * @param lines - The output lines array
 * @param unit - The generation unit
 * @param state - The generator state
 * @param use - Optional override for the "use" attribute value (from referencing element)
 */
export function emitSingleAttribute(
  attr: XmldomElement,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  use?: string
): void {
  const attrName = attr.getAttribute("name");
  if (!attrName) return;

  const at = attr.getAttribute("type");
  const tsType = resolveType(at, state);

  // Track enum dependencies for attributes
  if (
    at &&
    tsType !== "string" &&
    tsType !== "number" &&
    tsType !== "boolean"
  ) {
    const local = localName(at);
    const sanitized = sanitizeTypeName(local!);
    if (local && tsType === sanitized) {
      unit.deps.add(sanitized);
    }
  }

  const ans = attributeNamespaceFor(
    attr,
    state.schemaContext.targetNs,
    state.schemaContext.attributeFormDefault
  );
  const useValue = use || attr.getAttribute("use");
  const makeRequired = useValue === "required";
  const propName = toPropertyName(attrName, state.reservedWords);

  lines.push(buildXmlAttributeDecorator(attrName, ans, computeDecoratorType(tsType, state)));
  lines.push(`  ${propName}${makeRequired ? "!" : "?"}: ${tsType};`);
  lines.push("");
}

/**
 * Emits the anyAttribute wildcard property if not already emitted.
 *
 * @param lines - The output lines array
 */
export function emitAnyAttributeIfNeeded(lines: string[]): void {
  const hasAnyAttr = lines.some((l) => l.includes("@XmlAnyAttribute("));
  if (!hasAnyAttr) {
    lines.push(`  @XmlAnyAttribute()`);
    lines.push(`  _anyAttributes?: { [name: string]: string };`);
    lines.push("");
  }
}
