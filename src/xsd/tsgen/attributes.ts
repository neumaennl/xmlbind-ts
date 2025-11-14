import type { Element as XmldomElement } from "@xmldom/xmldom";
import { localName, getChildrenByLocalName } from "./utils";
import { resolveType, toPropertyName, attributeNamespaceFor } from "./codegen";
import type { GeneratorState, GenUnit } from "./codegen";
import { sanitizeTypeName, isBuiltinType } from "./types";

/**
 * Emits @XmlAttribute decorators and properties for all attributes in an XSD element.
 *
 * Processes both direct attributes and attributes from referenced attribute groups.
 * Also handles xs:anyAttribute wildcards.
 *
 * @param targetEl - The XSD element containing attribute definitions
 * @param lines - The output lines array
 * @param unit - The generation unit for tracking dependencies
 * @param state - The generator state
 */
export function emitAttrs(
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

    // Handle attribute references
    const refAttr = a.getAttribute("ref");
    if (refAttr && !a.getAttribute("name")) {
      const use = a.getAttribute("use");
      emitAttributeRef(refAttr, lines, unit, state, use || undefined);
      continue;
    }

    const an = a.getAttribute("name");
    if (!an) continue;
    const at = a.getAttribute("type");
    const tsType = resolveType(at, state);
    
    // Track enum dependencies for attributes
    if (at) {
      const local = localName(at);
      if (local && (state.schemaContext.enumTypesMap.has(local) || state.generatedEnums.has(sanitizeTypeName(local)))) {
        unit.deps.add(sanitizeTypeName(local));
      } else if (local && !isBuiltinType(at)) {
        unit.deps.add(sanitizeTypeName(local));
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
    const use = a.getAttribute("use");
    const makeRequired = use === "required";
    lines.push(
      `  ${propName}${makeRequired ? "!" : "?"}: ${tsType};`
    );
    lines.push("");
  }

  // anyAttribute wildcard
  const anyAttrs: XmldomElement[] = getChildrenByLocalName(
    targetEl,
    "anyAttribute",
    state.xsdPrefix
  );
  if (anyAttrs.length > 0) {
    ensureAnyAttribute(lines);
  }
}

/**
 * Emits code for a referenced attribute (ref attribute).
 * Looks up the attribute definition and generates the property.
 *
 * @param refAttr - The attribute reference (QName)
 * @param lines - The output lines array
 * @param unit - The generation unit for tracking dependencies
 * @param state - The generator state
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
    if (at) {
      const local = localName(at);
      if (local && (state.schemaContext.enumTypesMap.has(local) || state.generatedEnums.has(sanitizeTypeName(local)))) {
        unit.deps.add(sanitizeTypeName(local));
      } else if (local && !isBuiltinType(at)) {
        unit.deps.add(sanitizeTypeName(local));
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
      lines.push(
        `  ${propName}${makeRequired ? "!" : "?"}: ${tsType};`
      );
      lines.push("");
    }
  }
}

/**
 * Ensures an @XmlAnyAttribute property exists in the generated class.
 * Checks if one already exists to avoid duplicates.
 *
 * @param lines - The output lines array
 */
function ensureAnyAttribute(lines: string[]): void {
  if (!lines.some((l) => l.includes("@XmlAnyAttribute("))) {
    lines.push(`  @XmlAnyAttribute()`);
    lines.push(`  _anyAttributes?: { [name: string]: string };`);
    lines.push("");
  }
}
