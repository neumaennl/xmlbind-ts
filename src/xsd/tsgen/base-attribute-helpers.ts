import type { Element as XmldomElement } from "@xmldom/xmldom";
import { localName, getChildByLocalName, getChildrenByLocalName } from "./utils";
import { isBuiltinType } from "./types";
import type { GeneratorState, GenUnit } from "./codegen";
import { emitSingleAttribute, emitAnyAttributeIfNeeded } from "./attribute-emission";

/**
 * Emits all attributes (attributeGroups, direct attributes, anyAttribute) from a base type.
 * This recursively processes the base type chain to collect all inherited attributes.
 *
 * @param baseTypeName - The base type QName
 * @param lines - The output lines array
 * @param unit - The generation unit
 * @param state - The generator state
 * @param excludeAttrNames - Set of attribute names to exclude (already defined in restriction)
 */
export function emitBaseAttributes(
  baseTypeName: string | null,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  excludeAttrNames: Set<string> = new Set()
): void {
  if (!baseTypeName) return;

  const baseLocal = localName(baseTypeName);
  if (!baseLocal || isBuiltinType(baseTypeName)) return;

  // Look up the base complexType
  const baseComplexType = state.schemaContext.complexTypesMap.get(baseLocal);
  if (!baseComplexType) return;

  // Recursively process base type's base (if it has extension/restriction)
  const baseComplexContent = getChildByLocalName(
    baseComplexType,
    "complexContent",
    state.xsdPrefix
  );
  if (baseComplexContent) {
    const baseExt = getChildByLocalName(
      baseComplexContent,
      "extension",
      state.xsdPrefix
    );
    const baseRest = getChildByLocalName(
      baseComplexContent,
      "restriction",
      state.xsdPrefix
    );
    const baseOfBase =
      baseExt?.getAttribute("base") || baseRest?.getAttribute("base");
    if (baseOfBase) {
      emitBaseAttributes(baseOfBase, lines, unit, state, excludeAttrNames);
    }

    // Emit all attributes from the base's extension/restriction
    if (baseExt) {
      emitAllAttributesFiltered(baseExt, lines, unit, state, excludeAttrNames);
    } else if (baseRest) {
      emitAllAttributesFiltered(baseRest, lines, unit, state, excludeAttrNames);
    }
  } else {
    // Direct complexType without complexContent - emit all its attributes
    emitAllAttributesFiltered(
      baseComplexType,
      lines,
      unit,
      state,
      excludeAttrNames
    );
  }
}

/**
 * Emits all attributes (attributeGroups, direct attributes, anyAttribute) from an element.
 * Excludes attributes whose names are in the excludeSet.
 *
 * @param targetEl - The XSD element containing attribute definitions
 * @param lines - The output lines array
 * @param unit - The generation unit
 * @param state - The generator state
 * @param excludeAttrNames - Set of attribute names to exclude (already defined in restriction)
 */
export function emitAllAttributesFiltered(
  targetEl: XmldomElement,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  excludeAttrNames: Set<string> = new Set()
): void {
  // First, emit attributes from attributeGroup references
  const attrGroups = getChildrenByLocalName(
    targetEl,
    "attributeGroup",
    state.xsdPrefix
  );

  for (const ag of attrGroups) {
    const ref = ag.getAttribute("ref");
    if (ref) {
      const local = localName(ref);
      if (!local) continue;

      const def = state.schemaContext.attributeGroupDefs.get(local);
      if (def) {
        // Emit all attributes from this attributeGroup, excluding those in excludeAttrNames
        emitAttrsFiltered(def, lines, unit, state, excludeAttrNames);
      }
    }
  }

  // Second, emit direct attributes (not in attributeGroups)
  const directAttrs = getChildrenByLocalName(
    targetEl,
    "attribute",
    state.xsdPrefix
  );
  for (const attr of directAttrs) {
    // Only process attributes that are direct children of targetEl (not from attributeGroups)
    if (attr.parentNode !== targetEl) continue;

    const attrName = attr.getAttribute("name");

    // Skip if this attribute is being redefined in the restriction
    if (attrName && excludeAttrNames.has(attrName)) {
      continue;
    }

    // Handle attribute reference
    const refAttr = attr.getAttribute("ref");
    if (refAttr && !attrName) {
      // For attribute refs, we'd need to look them up - skip for now
      continue;
    }

    if (!attrName) continue;
    emitSingleAttribute(attr, lines, unit, state);
  }

  // Third, check for anyAttribute (only if not already present in restriction)
  const anyAttrs = getChildrenByLocalName(
    targetEl,
    "anyAttribute",
    state.xsdPrefix
  );
  if (anyAttrs.length > 0) {
    emitAnyAttributeIfNeeded(lines);
  }
}

/**
 * Emits attributes from an element, but excludes any attributes whose names are in the excludeSet.
 * This is used to avoid duplicating attributes when a restriction redefines base attributes.
 *
 * @param targetEl - The XSD element containing attribute definitions
 * @param lines - The output lines array
 * @param unit - The generation unit
 * @param state - The generator state
 * @param excludeAttrNames - Set of attribute names to skip
 */
export function emitAttrsFiltered(
  targetEl: XmldomElement,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  excludeAttrNames: Set<string> = new Set()
): void {
  const attrs = getChildrenByLocalName(
    targetEl,
    "attribute",
    state.xsdPrefix
  );
  for (const attr of attrs) {
    const attrName = attr.getAttribute("name");
    if (attrName && excludeAttrNames.has(attrName)) {
      continue;
    }

    // Handle attribute reference
    const refAttr = attr.getAttribute("ref");
    if (refAttr && !attrName) {
      // For attribute refs, we'd need to look them up - skip for now
      continue;
    }

    if (!attrName) continue;
    emitSingleAttribute(attr, lines, unit, state);
  }
}
