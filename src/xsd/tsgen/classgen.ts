import type { Element as XmldomElement } from "@xmldom/xmldom";
import {
  localName,
  getChildByLocalName,
  getChildrenByLocalName,
} from "./utils";
import { typeMapping, isBuiltinType, sanitizeTypeName } from "./types";
import { emitAttrs } from "./attributes";
import { emitElements } from "./elements";
import type { GeneratorState, GenUnit } from "./codegen";
import { resolveType, toPropertyName, attributeNamespaceFor } from "./codegen";

/**
 * Ensures a class is generated for a given XSD element, creating it if it doesn't exist.
 *
 * Generates a TypeScript class with appropriate decorators based on the XSD structure.
 * Handles simpleContent, complexContent with extension/restriction, and standard
 * sequence/choice/all content models.
 *
 * @param name - The class name to generate
 * @param el - The XSD element (complexType or element with inline type)
 * @param state - The generator state
 * @param xmlName - The XML element name (defaults to class name)
 * @returns The generation unit for the class
 */
export function ensureClass(
  name: string,
  el: XmldomElement,
  state: GeneratorState,
  xmlName?: string
): GenUnit {
  if (state.generated.has(name)) return state.generated.get(name)!;

  const unit: GenUnit = { lines: [], deps: new Set(), className: name };
  state.generated.set(name, unit);

  const lines = unit.lines;
  const rootName = xmlName ?? name;
  const mixed = el.getAttribute("mixed") === "true";
  const complexContent = getChildByLocalName(
    el,
    "complexContent",
    state.xsdPrefix
  );
  const simpleContent = getChildByLocalName(
    el,
    "simpleContent",
    state.xsdPrefix
  );

  emitRootDecorator(rootName, state, lines);

  if (simpleContent) {
    handleSimpleContent(name, simpleContent, lines, unit, state);
    return unit;
  }

  if (complexContent) {
    const handled = handleComplexContent(
      name,
      complexContent,
      lines,
      unit,
      state,
      mixed
    );
    if (handled) return unit;
  }

  // Default: complexType with sequence/choice/attributes
  lines.push(`export class ${name} {`);
  emitAttrs(el, lines, unit, state);
  emitElements(el, lines, unit, state, (n, e, x) =>
    ensureClass(n, e, state, x)
  );
  if (mixed) {
    emitMixedText(lines);
  }
  lines.push("}");
  return unit;
}

/**
 * Emits the @XmlRoot decorator for a class.
 * Includes namespace and prefix configuration if present in the schema.
 *
 * @param rootName - The XML root element name
 * @param state - The generator state
 * @param lines - The output lines array
 */
function emitRootDecorator(
  rootName: string,
  state: GeneratorState,
  lines: string[]
): void {
  const prefixObj = state.schemaContext.schemaPrefixes.size
    ? `, prefixes: { ${Array.from(state.schemaContext.schemaPrefixes.entries())
        .map(([uri, p]) => `'${uri}': '${p}'`)
        .join(", ")} }`
    : "";
  lines.push(
    `@XmlRoot('${rootName}'${
      state.schemaContext.targetNs
        ? `, { namespace: '${state.schemaContext.targetNs}'${prefixObj} }`
        : ""
    })`
  );
}

/**
 * Handles XSD simpleContent by generating a class with a @XmlText value property.
 * The class may also have attributes from extension or restriction.
 *
 * @param name - The class name
 * @param simpleContent - The XSD simpleContent element
 * @param lines - The output lines array
 * @param unit - The generation unit for tracking dependencies
 * @param state - The generator state
 */
function handleSimpleContent(
  name: string,
  simpleContent: XmldomElement,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState
): void {
  const ext =
    getChildByLocalName(simpleContent as any, "extension", state.xsdPrefix) ||
    getChildByLocalName(simpleContent as any, "restriction", state.xsdPrefix);
  let textTs = "String";
  if (ext) {
    const base = (ext as XmldomElement).getAttribute("base");
    if (base) textTs = typeMapping(base);
  }
  lines.push(`export class ${name} {`);
  lines.push(`  @XmlText()`);
  lines.push(`  value?: ${textTs};`);
  lines.push("");
  if (ext) emitAttrs(ext as any, lines, unit, state);
  lines.push("}");
}

/**
 * Handles XSD complexContent by processing extension or restriction.
 *
 * @param name - The class name
 * @param complexContent - The XSD complexContent element
 * @param lines - The output lines array
 * @param unit - The generation unit
 * @param state - The generator state
 * @param mixed - Whether the content is mixed (allows text)
 * @returns True if handled, false otherwise
 */
function handleComplexContent(
  name: string,
  complexContent: XmldomElement,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  mixed: boolean
): boolean {
  const ext = getChildByLocalName(
    complexContent as any,
    "extension",
    state.xsdPrefix
  );
  const rest = getChildByLocalName(
    complexContent as any,
    "restriction",
    state.xsdPrefix
  );

  if (ext) {
    handleExtension(name, ext, lines, unit, state, mixed);
    return true;
  } else if (rest) {
    handleRestriction(name, rest, lines, unit, state, mixed);
    return true;
  }

  return false;
}

/**
 * Handles XSD extension within complexContent.
 * Generates a class that extends the base type and adds new properties.
 *
 * @param name - The class name
 * @param ext - The XSD extension element
 * @param lines - The output lines array
 * @param unit - The generation unit
 * @param state - The generator state
 * @param mixed - Whether the content is mixed
 */
function handleExtension(
  name: string,
  ext: XmldomElement,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  mixed: boolean
): void {
  const base = (ext as XmldomElement).getAttribute("base");
  const baseLocal = localName(base);
  let extendsBase: string | undefined;

  if (baseLocal && !isBuiltinType(base)) {
    extendsBase = baseLocal;
    unit.deps.add(baseLocal);
  }

  lines.push(
    `export class ${name}${extendsBase ? ` extends ${extendsBase}` : ""} {`
  );
  emitAttrs(ext as any, lines, unit, state);
  emitElements(ext as any, lines, unit, state, (n, e, x) =>
    ensureClass(n, e, state, x)
  );
  if (mixed) {
    emitMixedText(lines);
  }
  lines.push("}");
}

/**
 * Handles XSD restriction within complexContent.
 * Generates a class with restricted content (no base class extension).
 *
 * For restrictions, we need to inherit attributeGroups from the base type
 * since restrictions can narrow but must include all base attributes.
 *
 * @param name - The class name
 * @param rest - The XSD restriction element
 * @param lines - The output lines array
 * @param unit - The generation unit
 * @param state - The generator state
 * @param mixed - Whether the content is mixed
 */
function handleRestriction(
  name: string,
  rest: XmldomElement,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  mixed: boolean
): void {
  lines.push(`export class ${name} {`);

  // Collect attribute names that are redefined or prohibited in this restriction or any parent restriction
  const excludedAttrNames = collectExcludedAttributesInRestrictionChain(
    rest,
    state
  );

  // Emit attributes from base type (excluding those redefined/prohibited in restriction chain)
  const base = rest.getAttribute("base");
  if (base) {
    emitBaseAttributes(base, lines, unit, state, excludedAttrNames);
  }

  // Emit attributes defined directly in the restriction (excluding prohibited ones)
  emitAttrsExcludingProhibited(rest as any, lines, unit, state);
  emitElements(rest as any, lines, unit, state, (n, e, x) =>
    ensureClass(n, e, state, x)
  );
  if (mixed) {
    emitMixedText(lines);
  }
  lines.push("}");
}

/**
 * Collects attribute names that should be excluded when processing a restriction.
 * This includes attributes defined/prohibited in the current restriction AND all parent restrictions.
 * Walks up the restriction chain to collect all excluded attributes.
 *
 * @param rest - The restriction element
 * @param state - The generator state
 * @returns Set of attribute names to exclude
 */
function collectExcludedAttributesInRestrictionChain(
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
 * Emits all attributes (attributeGroups, direct attributes, anyAttribute) from a base type.
 * This recursively processes the base type chain to collect all inherited attributes.
 *
 * @param baseTypeName - The base type QName
 * @param lines - The output lines array
 * @param unit - The generation unit
 * @param state - The generator state
 * @param excludeAttrNames - Set of attribute names to exclude (already defined in restriction)
 */
function emitBaseAttributes(
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
function emitAllAttributesFiltered(
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

    const at = attr.getAttribute("type");
    const tsType = resolveType(at, state);

    // Track enum dependencies for attributes
    if (
      at &&
      tsType !== "String" &&
      tsType !== "Number" &&
      tsType !== "Boolean"
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
    const use = attr.getAttribute("use");
    const makeRequired = use === "required";
    const propName = toPropertyName(attrName, state.reservedWords);

    lines.push(
      ans
        ? `  @XmlAttribute('${attrName}', { namespace: '${ans}' })`
        : `  @XmlAttribute('${attrName}')`
    );
    lines.push(`  ${propName}${makeRequired ? "!" : "?"}: ${tsType};`);
    lines.push("");
  }

  // Third, check for anyAttribute (only if not already present in restriction)
  // We check lines to see if anyAttribute was already emitted
  const hasAnyAttr = lines.some((l) => l.includes("@XmlAnyAttribute("));
  if (!hasAnyAttr) {
    const anyAttrs = getChildrenByLocalName(
      targetEl,
      "anyAttribute",
      state.xsdPrefix
    );
    if (anyAttrs.length > 0) {
      lines.push(`  @XmlAnyAttribute()`);
      lines.push(`  _anyAttributes?: { [name: string]: string };`);
      lines.push("");
    }
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
function emitAttrsFiltered(
  targetEl: XmldomElement,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  excludeAttrNames: Set<string>
): void {
  const attrs = getChildrenByLocalName(targetEl, "attribute", state.xsdPrefix);

  for (const attr of attrs) {
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

    const at = attr.getAttribute("type");
    const tsType = resolveType(at, state);

    // Track enum dependencies for attributes - only add if tsType is actually using the custom type
    if (
      at &&
      tsType !== "String" &&
      tsType !== "Number" &&
      tsType !== "Boolean"
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
    const use = attr.getAttribute("use");
    const makeRequired = use === "required";
    const propName = toPropertyName(attrName, state.reservedWords);

    lines.push(
      ans
        ? `  @XmlAttribute('${attrName}', { namespace: '${ans}' })`
        : `  @XmlAttribute('${attrName}')`
    );
    lines.push(`  ${propName}${makeRequired ? "!" : "?"}: ${tsType};`);
    lines.push("");
  }
}

/**
 * Emits a text content property for mixed content elements.
 * Mixed content allows elements to contain both text and child elements.
 *
 * @param lines - The output lines array
 */
function emitMixedText(lines: string[]): void {
  lines.push(`  @XmlText()`);
  lines.push(`  value?: String;`);
  lines.push("");
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
function emitAttrsExcludingProhibited(
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
      emitAttributeRef(refAttr, lines, unit, state, use || undefined);
      continue;
    }

    const an = a.getAttribute("name");
    if (!an) continue;
    const at = a.getAttribute("type");
    const tsType = resolveType(at, state);

    // Track enum dependencies for attributes
    if (
      at &&
      tsType !== "String" &&
      tsType !== "Number" &&
      tsType !== "Boolean"
    ) {
      const local = localName(at);
      const sanitized = sanitizeTypeName(local!);
      if (local && tsType === sanitized) {
        unit.deps.add(sanitized);
      }
    }

    const ans = attributeNamespaceFor(
      a,
      state.schemaContext.targetNs,
      state.schemaContext.attributeFormDefault
    );
    const propName = toPropertyName(an, state.reservedWords);
    lines.push(
      ans
        ? `  @XmlAttribute('${an}', { namespace: '${ans}' })`
        : `  @XmlAttribute('${an}')`
    );
    const makeRequired = use === "required";
    lines.push(`  ${propName}${makeRequired ? "!" : "?"}: ${tsType};`);
    lines.push("");
  }

  // anyAttribute wildcard
  const anyAttrs: XmldomElement[] = getChildrenByLocalName(
    targetEl,
    "anyAttribute",
    state.xsdPrefix
  );
  if (anyAttrs.length > 0) {
    // Check if anyAttribute was already emitted from base
    const hasAnyAttr = lines.some((l) => l.includes("@XmlAnyAttribute("));
    if (!hasAnyAttr) {
      lines.push(`  @XmlAnyAttribute()`);
      lines.push(`  _anyAttributes?: { [name: string]: string };`);
      lines.push("");
    }
  }
}

/**
 * Helper function to emit a single attribute reference.
 * Looks up the referenced attribute and generates the appropriate decorator.
 *
 * @param refAttr - The attribute reference QName
 * @param lines - The output lines array
 * @param unit - The generation unit
 * @param state - The generator state
 * @param referencingUse - The use constraint from the referencing element
 */
function emitAttributeRef(
  refAttr: string,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  referencingUse?: string
): void {
  const refLocal = localName(refAttr)!;
  const refDef = state.schemaContext.topLevelAttributes.get(refLocal);
  if (refDef) {
    const an = refDef.getAttribute("name");
    const at = refDef.getAttribute("type");
    const tsType = resolveType(at, state);

    // Track enum dependencies for referenced attributes
    if (
      at &&
      tsType !== "String" &&
      tsType !== "Number" &&
      tsType !== "Boolean"
    ) {
      const local = localName(at);
      const sanitized = sanitizeTypeName(local!);
      if (local && tsType === sanitized) {
        unit.deps.add(sanitized);
      }
    }

    const ans = attributeNamespaceFor(
      refDef,
      state.schemaContext.targetNs,
      state.schemaContext.attributeFormDefault
    );
    if (an) {
      const propName = toPropertyName(an, state.reservedWords);
      lines.push(
        ans
          ? `  @XmlAttribute('${an}', { namespace: '${ans}' })`
          : `  @XmlAttribute('${an}')`
      );
      const use = referencingUse || refDef.getAttribute("use");
      const makeRequired = use === "required";
      lines.push(`  ${propName}${makeRequired ? "!" : "?"}: ${tsType};`);
      lines.push("");
    }
  }
}
