import type { Element as XmldomElement } from "@xmldom/xmldom";
import { localName, getChildrenByLocalName } from "./utils";
import { elementNamespaceFor } from "./codegen";
import type { GeneratorState, GenUnit } from "./codegen";
import { emitElementRef } from "./element-refs";
import { resolveElementType, handleInlineType, emitElementDecorator } from "./element-types";

/**
 * Determines if a maxOccurs attribute value indicates an array.
 * @param maxOccurs - The maxOccurs attribute value (e.g., "1", "unbounded", "5")
 * @returns True if the element should be an array (maxOccurs is "unbounded" or > 1)
 */
function isArrayFromMaxOccurs(maxOccurs: string | null): boolean {
  if (!maxOccurs) return false;
  if (maxOccurs === "unbounded") return true;
  const numValue = Number(maxOccurs);
  // Handle invalid maxOccurs values by treating them as single elements (default behavior)
  if (isNaN(numValue)) return false;
  return numValue > 1;
}

/**
 * Determines if a minOccurs attribute value indicates an optional element/compositor.
 * @param minOccurs - The minOccurs attribute value (e.g., "0", "1")
 * @returns True if the element/compositor is optional (minOccurs is 0)
 */
function isOptionalFromMinOccurs(minOccurs: string | null): boolean {
  if (!minOccurs) return false; // default is "1", so not optional
  const numValue = Number(minOccurs);
  if (isNaN(numValue)) return false;
  return numValue === 0;
}

/**
 * Determines if a minOccurs attribute value indicates an array (multiple required occurrences).
 * @param minOccurs - The minOccurs attribute value (e.g., "0", "1", "2")
 * @returns True if the element must appear multiple times (minOccurs > 1)
 */
function isArrayFromMinOccurs(minOccurs: string | null): boolean {
  if (!minOccurs) return false; // default is "1", so not array
  const numValue = Number(minOccurs);
  if (isNaN(numValue)) return false;
  return numValue > 1;
}

/**
 * Emits @XmlElement decorators and properties for all child elements in an XSD type.
 *
 * Processes xs:sequence, xs:choice, xs:all, and xs:group elements.
 * Handles element references, inline types, and xs:any wildcards.
 *
 * @param ctx - The XSD element context (complexType, extension, etc.)
 * @param lines - The output lines array
 * @param unit - The generation unit for tracking dependencies
 * @param state - The generator state
 * @param ensureClass - Callback to ensure a class is generated for complex types
 * @param compositorIsArray - Whether we're inside a compositor with maxOccurs > 1
 * @param compositorIsOptional - Whether we're inside a compositor with minOccurs = 0
 */
function emitElementsWithMultiplicity(
  ctx: XmldomElement,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  ensureClass: (name: string, el: XmldomElement, xmlName?: string) => GenUnit,
  compositorIsArray: boolean = false,
  compositorIsOptional: boolean = false
): void {
  function processGroup(grp: XmldomElement, compositorIsArray: boolean = false, compositorIsOptional: boolean = false) {
    const ref = grp.getAttribute("ref");
    if (ref) {
      const refLocal = localName(ref)!;
      const def = state.schemaContext.groupDefs.get(refLocal);
      if (def) {
        emitElementsWithMultiplicity(def, lines, unit, state, ensureClass, compositorIsArray, compositorIsOptional);
      }
    } else {
      emitElementsWithMultiplicity(grp, lines, unit, state, ensureClass, compositorIsArray, compositorIsOptional);
    }
  }

  function ensureAnyElement(lines: string[]) {
    if (!lines.some((l) => l.includes("@XmlAnyElement("))) {
      lines.push(`  @XmlAnyElement()`);
      lines.push(`  _any?: unknown[];`);
      lines.push("");
    }
  }

  // Process sequences
  processElementContainer(
    ctx,
    "sequence",
    lines,
    unit,
    state,
    ensureClass,
    processGroup,
    ensureAnyElement,
    compositorIsArray,
    compositorIsOptional
  );

  // Process choices
  processElementContainer(
    ctx,
    "choice",
    lines,
    unit,
    state,
    ensureClass,
    processGroup,
    ensureAnyElement,
    compositorIsArray,
    compositorIsOptional
  );

  // Process all
  processElementContainer(
    ctx,
    "all",
    lines,
    unit,
    state,
    ensureClass,
    processGroup,
    ensureAnyElement,
    compositorIsArray,
    compositorIsOptional
  );

  // Handle groups that are direct children of ctx
  const directGroups: XmldomElement[] = getChildrenByLocalName(
    ctx,
    "group",
    state.xsdPrefix
  );
  for (const grp of directGroups) {
    if ((grp.parentNode as any) !== ctx) continue;
    processGroup(grp, compositorIsArray, compositorIsOptional);
  }
}

/**
 * Public wrapper for emitElementsWithMultiplicity that doesn't expose the compositor parameters
 */
export function emitElements(
  ctx: XmldomElement,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  ensureClass: (name: string, el: XmldomElement, xmlName?: string) => GenUnit
): void {
  emitElementsWithMultiplicity(ctx, lines, unit, state, ensureClass, false, false);
}

/**
 * Processes a container element (sequence, choice, or all).
 * Iterates through child elements, groups, and wildcard elements.
 *
 * @param ctx - The parent XSD element
 * @param containerType - The type of container ("sequence", "choice", or "all")
 * @param lines - The output lines array
 * @param unit - The generation unit
 * @param state - The generator state
 * @param ensureClass - Callback to ensure classes are generated
 * @param processGroup - Callback to process group references
 * @param ensureAnyElement - Callback to ensure any element wildcard
 * @param parentCompositorIsArray - Whether the parent compositor has maxOccurs > 1
 * @param parentCompositorIsOptional - Whether the parent compositor has minOccurs = 0
 */
function processElementContainer(
  ctx: XmldomElement,
  containerType: string,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  ensureClass: (name: string, el: XmldomElement, xmlName?: string) => GenUnit,
  processGroup: (grp: XmldomElement, compositorIsArray?: boolean, compositorIsOptional?: boolean) => void,
  ensureAnyElement: (lines: string[]) => void,
  parentCompositorIsArray: boolean = false,
  parentCompositorIsOptional: boolean = false
): void {
  const containers: XmldomElement[] = getChildrenByLocalName(
    ctx,
    containerType,
    state.xsdPrefix
  );

  for (const container of containers) {
    if ((container.parentNode as any) !== ctx) continue;

    // Check if this compositor itself has maxOccurs > 1
    const thisCompositorIsArray = isArrayFromMaxOccurs(container.getAttribute("maxOccurs"));
    
    // Check if this compositor itself has minOccurs = 0
    const thisCompositorIsOptional = isOptionalFromMinOccurs(container.getAttribute("minOccurs"));
    
    // Combine with parent compositor flags
    const compositorIsArray = parentCompositorIsArray || thisCompositorIsArray;
    const compositorIsOptional = parentCompositorIsOptional || thisCompositorIsOptional;

    processCompositorChildren(
      container,
      lines,
      unit,
      state,
      ensureClass,
      processGroup,
      ensureAnyElement,
      containerType === "choice",
      compositorIsArray,
      compositorIsOptional
    );
  }
}

/**
 * Processes the children of a compositor element (sequence, choice, or all).
 * Handles element, group, any, and nested compositor children.
 *
 * @param compositor - The compositor element to process
 * @param lines - The output lines array
 * @param unit - The generation unit
 * @param state - The generator state
 * @param ensureClass - Callback to ensure classes are generated
 * @param processGroup - Callback to process group references
 * @param ensureAnyElement - Callback to ensure any element wildcard
 * @param insideChoice - Whether we're inside a choice (affects optionality)
 * @param compositorIsArray - Whether we're inside a compositor with maxOccurs > 1
 * @param compositorIsOptional - Whether we're inside a compositor with minOccurs = 0
 */
function processCompositorChildren(
  compositor: XmldomElement,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  ensureClass: (name: string, el: XmldomElement, xmlName?: string) => GenUnit,
  processGroup: (grp: XmldomElement, compositorIsArray?: boolean, compositorIsOptional?: boolean) => void,
  ensureAnyElement: (lines: string[]) => void,
  insideChoice: boolean,
  compositorIsArray: boolean = false,
  compositorIsOptional: boolean = false
): void {
  const children = Array.from((compositor as any).childNodes || []);
  for (const child of children) {
    const childNode = child as any;
    if (!childNode || childNode.nodeType !== 1) continue;
    const localN =
      childNode.localName ||
      childNode.tagName?.split(":")[1] ||
      childNode.tagName;

    if (localN === "element") {
      emitElement(
        childNode as XmldomElement,
        lines,
        unit,
        state,
        ensureClass,
        insideChoice,
        compositorIsArray,
        compositorIsOptional
      );
    } else if (localN === "group") {
      processGroup(childNode as XmldomElement, compositorIsArray, compositorIsOptional);
    } else if (localN === "any") {
      ensureAnyElement(lines);
    } else if (localN === "sequence" || localN === "choice" || localN === "all") {
      // Check if this nested compositor itself has maxOccurs > 1
      const thisCompositorIsArray = isArrayFromMaxOccurs(childNode.getAttribute("maxOccurs"));
      // Check if this nested compositor itself has minOccurs = 0
      const thisCompositorIsOptional = isOptionalFromMinOccurs(childNode.getAttribute("minOccurs"));
      
      // Recursively process nested compositors, combining flags
      processCompositorChildren(
        childNode as XmldomElement,
        lines,
        unit,
        state,
        ensureClass,
        processGroup,
        ensureAnyElement,
        insideChoice || localN === "choice",
        compositorIsArray || thisCompositorIsArray,
        compositorIsOptional || thisCompositorIsOptional
      );
    }
  }
}

/**
 * Emits code for a single xs:element definition.
 * Handles both elements with type attributes and inline type definitions.
 *
 * @param e - The XSD element
 * @param lines - The output lines array
 * @param unit - The generation unit
 * @param state - The generator state
 * @param ensureClass - Callback to ensure classes are generated
 * @param insideChoice - Whether this element is inside an xs:choice (affects optionality)
 * @param compositorIsArray - Whether this element is inside a compositor with maxOccurs > 1
 * @param compositorIsOptional - Whether this element is inside a compositor with minOccurs = 0
 */
export function emitElement(
  e: XmldomElement,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  ensureClass: (name: string, el: XmldomElement, xmlName?: string) => GenUnit,
  insideChoice: boolean,
  compositorIsArray: boolean = false,
  compositorIsOptional: boolean = false
): void {
  const en = e.getAttribute("name");
  const refAttr = e.getAttribute("ref");

  if (refAttr && !en) {
    emitElementRef(
      e,
      refAttr,
      lines,
      unit,
      state,
      insideChoice,
      compositorIsArray,
      compositorIsOptional,
      isArrayFromMaxOccurs
    );
    return;
  }

  if (!en) return;

  const typeAttr = e.getAttribute("type");
  const minOccursAttr = e.getAttribute("minOccurs");
  const maxOccursAttr = e.getAttribute("maxOccurs");
  
  const elementIsArrayFromMax = isArrayFromMaxOccurs(maxOccursAttr);
  const elementIsArrayFromMin = isArrayFromMinOccurs(minOccursAttr);
  // Element is an array if:
  // 1. maxOccurs > 1 (can appear multiple times)
  // 2. minOccurs > 1 (must appear multiple times)
  // 3. Inside a compositor with maxOccurs > 1
  const isArray = elementIsArrayFromMax || elementIsArrayFromMin || compositorIsArray;
  const nillable = e.getAttribute("nillable") === "true";
  const min = minOccursAttr ?? "1";
  // Element is required only if it's not in a choice, has minOccurs >= 1, and is not inside an optional compositor
  const makeRequired = !insideChoice && Number(min) >= 1 && !compositorIsOptional;
  const ens = elementNamespaceFor(
    e,
    false,
    state.schemaContext.targetNs,
    state.schemaContext.elementFormDefault
  );

  let tsType = "any";

  if (typeAttr) {
    tsType = resolveElementType(typeAttr, unit, state);
  } else {
    tsType = handleInlineType(e, en, unit, state, ensureClass);
  }

  emitElementDecorator(
    en,
    tsType,
    isArray,
    nillable,
    ens,
    lines,
    unit,
    state,
    makeRequired
  );
}
