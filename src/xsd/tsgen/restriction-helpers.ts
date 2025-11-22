import type { Element as XmldomElement } from "@xmldom/xmldom";
import { localName, getChildByLocalName, getChildrenByLocalName } from "./utils";
import { isBuiltinType } from "./types";
import type { GeneratorState, GenUnit } from "./codegen";
import { emitSingleAttribute, emitAnyAttributeIfNeeded } from "./attribute-emission";

/**
 * Collects attribute names that should be excluded when processing a restriction.
 * This includes attributes defined/prohibited in the current restriction AND all parent restrictions.
 * Walks up the restriction chain to collect all excluded attributes.
 *
 * @param rest - The restriction element
 * @param state - The generator state
 * @returns Set of attribute names to exclude
 */
export function collectExcludedAttributesInRestrictionChain(
  rest: XmldomElement,
  state: GeneratorState
): Set<string> {
  const excluded = new Set<string>();

  // Get attributes from current restriction
  const directAttrs = getChildrenByLocalName(
    rest,
    "attribute",
    state.xsdPrefix
  );
  for (const attr of directAttrs) {
    const attrName = attr.getAttribute("name");
    if (attrName) {
      excluded.add(attrName);
    }
  }

  // Walk up the base type chain and collect prohibited/redefined attributes
  const base = rest.getAttribute("base");
  if (base) {
    const baseLocal = localName(base);
    if (baseLocal && !isBuiltinType(base)) {
      const baseComplexType =
        state.schemaContext.complexTypesMap.get(baseLocal);
      if (baseComplexType) {
        const baseComplexContent = getChildByLocalName(
          baseComplexType,
          "complexContent",
          state.xsdPrefix
        );
        if (baseComplexContent) {
          const baseRest = getChildByLocalName(
            baseComplexContent,
            "restriction",
            state.xsdPrefix
          );
          if (baseRest) {
            // Recursively collect from parent restrictions
            const parentExcluded = collectExcludedAttributesInRestrictionChain(
              baseRest,
              state
            );
            for (const name of parentExcluded) {
              excluded.add(name);
            }
          }
        }
      }
    }
  }

  return excluded;
}

/**
 * Emits attributes from an element, but skips attributes with use="prohibited".
 * Used in restrictions where attributes from base type can be prohibited.
 *
 * @param targetEl - The XSD element containing attribute definitions
 * @param lines - The output lines array
 * @param unit - The generation unit
 * @param state - The generator state
 */
export function emitAttrsExcludingProhibited(
  targetEl: XmldomElement,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState
): void {
  let attrs: XmldomElement[] = getChildrenByLocalName(
    targetEl,
    "attribute",
    state.xsdPrefix
  );

  const groupAttrs = new Set<XmldomElement>();

  // Merge in attributes from referenced attribute groups
  const attrGroups: XmldomElement[] = getChildrenByLocalName(
    targetEl,
    "attributeGroup",
    state.xsdPrefix
  );
  for (const ag of attrGroups) {
    const ref = ag.getAttribute("ref");
    if (ref) {
      const local = localName(ref)!;
      const def = state.schemaContext.attributeGroupDefs.get(local);
      if (def) {
        const agAttrs = getChildrenByLocalName(
          def,
          "attribute",
          state.xsdPrefix
        );
        for (const a of agAttrs) {
          groupAttrs.add(a);
        }
        attrs = attrs.concat(agAttrs);
      }
    }
  }

  for (const a of attrs) {
    if (!groupAttrs.has(a) && (a.parentNode as any) !== targetEl) continue;

    // Skip prohibited attributes
    const use = a.getAttribute("use");
    if (use === "prohibited") {
      continue;
    }

    // Handle attribute references
    const refAttr = a.getAttribute("ref");
    if (refAttr && !a.getAttribute("name")) {
      const refLocal = localName(refAttr)!;
      const refDef = state.schemaContext.topLevelAttributes.get(refLocal);
      if (refDef) {
        emitSingleAttribute(refDef, lines, unit, state, use || undefined);
      }
      continue;
    }

    const an = a.getAttribute("name");
    if (!an) continue;
    emitSingleAttribute(a, lines, unit, state, use || undefined);
  }

  // anyAttribute wildcard
  const anyAttrs: XmldomElement[] = getChildrenByLocalName(
    targetEl,
    "anyAttribute",
    state.xsdPrefix
  );
  if (anyAttrs.length > 0) {
    emitAnyAttributeIfNeeded(lines);
  }
}
