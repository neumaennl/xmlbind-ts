import type { Element as XmldomElement } from "@xmldom/xmldom";
import { localName } from "./utils";
import { sanitizeTypeName, toDecoratorType, requiresRuntimeTypeCoercion } from "./types";
import type { GeneratorState, GenUnit } from "./codegen";
import { resolveType, toPropertyName, attributeNamespaceFor } from "./codegen";

/**
 * Builds the `@XmlAttribute(...)` decorator line for code generation.
 *
 * Includes the `type` option when the TypeScript type requires runtime coercion
 * (i.e. for `number`, `boolean`, and `Date`), so that the unmarshaller can cast
 * the XML string value to the correct primitive type.
 *
 * @param attrName - The XML attribute name
 * @param ans - Optional XML namespace URI for the attribute
 * @param tsType - The resolved TypeScript type name
 * @returns The decorator line string (e.g. `  @XmlAttribute('id', { type: Number })`)
 */
export function buildXmlAttributeDecorator(
  attrName: string,
  ans: string | null | undefined,
  tsType: string
): string {
  const decoratorType = requiresRuntimeTypeCoercion(tsType) ? toDecoratorType(tsType) : undefined;

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

  lines.push(buildXmlAttributeDecorator(attrName, ans, tsType));
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
