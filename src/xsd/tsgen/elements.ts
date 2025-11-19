import type { Element as XmldomElement } from "@xmldom/xmldom";
import {
  localName,
  getChildByLocalName,
  getChildrenByLocalName,
} from "./utils";
import { typeMapping, sanitizeTypeName } from "./types";
import { extractEnumValues, generateEnumCode } from "./enum";
import { toPropertyName, toClassName, elementNamespaceFor } from "./codegen";
import type { GeneratorState, GenUnit } from "./codegen";

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
 */
export function emitElements(
  ctx: XmldomElement,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  ensureClass: (name: string, el: XmldomElement, xmlName?: string) => GenUnit
): void {
  function processGroup(grp: XmldomElement) {
    const ref = grp.getAttribute("ref");
    if (ref) {
      const refLocal = localName(ref)!;
      const def = state.schemaContext.groupDefs.get(refLocal);
      if (def) {
        emitElements(def, lines, unit, state, ensureClass);
      }
    } else {
      emitElements(grp, lines, unit, state, ensureClass);
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
    ensureAnyElement
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
    ensureAnyElement
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
    ensureAnyElement
  );

  // Handle groups that are direct children of ctx
  const directGroups: XmldomElement[] = getChildrenByLocalName(
    ctx,
    "group",
    state.xsdPrefix
  );
  for (const grp of directGroups) {
    if ((grp.parentNode as any) !== ctx) continue;
    processGroup(grp);
  }
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
 */
function processElementContainer(
  ctx: XmldomElement,
  containerType: string,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  ensureClass: (name: string, el: XmldomElement, xmlName?: string) => GenUnit,
  processGroup: (grp: XmldomElement) => void,
  ensureAnyElement: (lines: string[]) => void
): void {
  const containers: XmldomElement[] = getChildrenByLocalName(
    ctx,
    containerType,
    state.xsdPrefix
  );

  for (const container of containers) {
    if ((container.parentNode as any) !== ctx) continue;

    processCompositorChildren(
      container,
      lines,
      unit,
      state,
      ensureClass,
      processGroup,
      ensureAnyElement,
      containerType === "choice"
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
 */
function processCompositorChildren(
  compositor: XmldomElement,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  ensureClass: (name: string, el: XmldomElement, xmlName?: string) => GenUnit,
  processGroup: (grp: XmldomElement) => void,
  ensureAnyElement: (lines: string[]) => void,
  insideChoice: boolean
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
        insideChoice
      );
    } else if (localN === "group") {
      processGroup(childNode as XmldomElement);
    } else if (localN === "any") {
      ensureAnyElement(lines);
    } else if (localN === "sequence" || localN === "choice" || localN === "all") {
      // Recursively process nested compositors
      processCompositorChildren(
        childNode as XmldomElement,
        lines,
        unit,
        state,
        ensureClass,
        processGroup,
        ensureAnyElement,
        insideChoice || localN === "choice"
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
 */
export function emitElement(
  e: XmldomElement,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  ensureClass: (name: string, el: XmldomElement, xmlName?: string) => GenUnit,
  insideChoice: boolean
): void {
  const en = e.getAttribute("name");
  const refAttr = e.getAttribute("ref");

  if (refAttr && !en) {
    emitElementRef(e, refAttr, lines, unit, state, insideChoice);
    return;
  }

  if (!en) return;

  const typeAttr = e.getAttribute("type");
  const max = e.getAttribute("maxOccurs") ?? "1";
  const isArray = max === "unbounded" || Number(max) > 1;
  const nillable = e.getAttribute("nillable") === "true";
  const min = e.getAttribute("minOccurs") ?? "1";
  const makeRequired = !insideChoice && Number(min) >= 1;
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

/**
 * Checks if a property with the given name has already been emitted.
 * Used to prevent duplicate property declarations.
 *
 * @param propName - The property name to check
 * @param lines - The output lines array
 * @returns True if the property already exists, false otherwise
 */
function isPropertyAlreadyEmitted(propName: string, lines: string[]): boolean {
  const propertyPattern = new RegExp(`^  ${propName}[!?]:`);
  return lines.some((line) => propertyPattern.test(line));
}

/**
 * Emits code for an element reference (ref attribute).
 * Looks up the referenced element definition and generates the property.
 *
 * @param e - The XSD element with ref attribute
 * @param refAttr - The reference attribute value (QName)
 * @param lines - The output lines array
 * @param unit - The generation unit
 * @param state - The generator state
 * @param insideChoice - Whether this element is inside an xs:choice (affects optionality)
 */
function emitElementRef(
  e: XmldomElement,
  refAttr: string,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  insideChoice: boolean
): void {
  const refLocalName = localName(refAttr)!;
  const max = e.getAttribute("maxOccurs") ?? "1";
  const isArray = max === "unbounded" || Number(max) > 1;
  const nillable = e.getAttribute("nillable") === "true";
  const min = e.getAttribute("minOccurs") ?? "1";
  const makeRequired = !insideChoice && Number(min) >= 1;

  const referencedElement = state.schemaContext.topLevelElements.find(
    (el) => el.getAttribute("name") === refLocalName
  );

  if (referencedElement) {
    const refType = referencedElement.getAttribute("type");
    const refNs =
      referencedElement.getAttribute("targetNamespace") ||
      (referencedElement.parentNode as any)?.getAttribute?.("targetNamespace");

    let tsType = "any";
    if (refType) {
      const local = localName(refType)!;
      const sanitized = sanitizeTypeName(local);
      if (state.schemaContext.enumTypesMap.has(local)) {
        tsType = sanitized;
        unit.deps.add(sanitized);
      } else {
        tsType = typeMapping(refType);
        // Only add dependency if the resolved type is actually the custom type (not a built-in)
        if (
          tsType !== "String" &&
          tsType !== "Number" &&
          tsType !== "Boolean" &&
          tsType === sanitized
        ) {
          unit.deps.add(sanitized);
        }
      }
    }

    const propName = toPropertyName(refLocalName, state.reservedWords);
    
    // Check if this property name has already been emitted to avoid duplicates
    if (isPropertyAlreadyEmitted(propName, lines)) {
      return;
    }
    
    const decoratorOpts: string[] = [];
    // Don't include type in decorator if it's a self-reference (to avoid "used before declaration" error)
    const isSelfReference = tsType === unit.className;
    if (
      tsType &&
      tsType !== "any" &&
      /^[A-Za-z0-9_]+$/.test(tsType) &&
      !isSelfReference
    ) {
      decoratorOpts.push(`type: ${tsType}`);
    }
    if (isArray) decoratorOpts.push("array: true");
    if (nillable) decoratorOpts.push("nillable: true");
    if (refNs) decoratorOpts.push(`namespace: '${refNs}'`);

    const decoratorBody = decoratorOpts.length
      ? `{ ${decoratorOpts.join(", ")} }`
      : "";
    lines.push(
      decoratorBody
        ? `  @XmlElement('${refLocalName}', ${decoratorBody})`
        : `  @XmlElement('${refLocalName}')`
    );
    lines.push(
      `  ${propName}${makeRequired ? "!" : "?"}: ${tsType}${
        isArray ? "[]" : ""
      };`
    );
    lines.push("");
  }
}

/**
 * Resolves an XSD type reference for an element to a TypeScript type.
 * Handles enums, built-in types, and user-defined types.
 *
 * @param typeAttr - The XSD type attribute value
 * @param unit - The generation unit for tracking dependencies
 * @param state - The generator state
 * @returns The TypeScript type name
 */
function resolveElementType(
  typeAttr: string,
  unit: GenUnit,
  state: GeneratorState
): string {
  const local = localName(typeAttr)!;
  const sanitized = sanitizeTypeName(local);

  if (state.schemaContext.enumTypesMap.has(local)) {
    const tsType = sanitized;
    // Don't add self-references to deps
    if (tsType !== unit.className) {
      unit.deps.add(tsType);
    }
    return tsType;
  } else {
    const tsType = typeMapping(typeAttr);
    // Only add dependency if the resolved type is actually the custom type (not a built-in)
    if (
      tsType !== "String" &&
      tsType !== "Number" &&
      tsType !== "Boolean" &&
      tsType === sanitized
    ) {
      // Don't add self-references to deps
      if (sanitized !== unit.className) {
        unit.deps.add(sanitized);
      }
    }
    return tsType;
  }
}

/**
 * Handles inline type definitions within an element.
 * Generates anonymous classes or enums for inline complex or simple types.
 *
 * @param e - The XSD element containing the inline type
 * @param en - The element name
 * @param unit - The generation unit
 * @param state - The generator state
 * @param ensureClass - Callback to ensure classes are generated
 * @returns The TypeScript type name for the inline type
 */
function handleInlineType(
  e: XmldomElement,
  en: string,
  unit: GenUnit,
  state: GeneratorState,
  ensureClass: (name: string, el: XmldomElement, xmlName?: string) => GenUnit
): string {
  const inlineCT = getChildByLocalName(e, "complexType", state.xsdPrefix);
  const inlineST = getChildByLocalName(e, "simpleType", state.xsdPrefix);

  if (inlineCT) {
    const anonName = toClassName(en + "Type", state.reservedWords);
    ensureClass(anonName, inlineCT as any);
    // Add dependency for the generated inline type
    if (anonName !== unit.className) {
      unit.deps.add(anonName);
    }
    return anonName;
  } else if (inlineST) {
    return handleInlineSimpleType(inlineST, en, unit, state);
  }

  return "any";
}

/**
 * Handles inline simpleType definitions within an element.
 * Generates enums for restrictions or maps unions/lists to TypeScript types.
 *
 * @param inlineST - The inline simpleType element
 * @param en - The element name (used for generating anonymous enum names)
 * @param unit - The generation unit
 * @param state - The generator state
 * @returns The TypeScript type name for the simple type
 */
function handleInlineSimpleType(
  inlineST: XmldomElement,
  en: string,
  unit: GenUnit,
  state: GeneratorState
): string {
  const rest = getChildByLocalName(
    inlineST as any,
    "restriction",
    state.xsdPrefix
  );

  if (rest) {
    const enumValues = extractEnumValues(
      rest as XmldomElement,
      state.xsdPrefix
    );
    if (enumValues.length > 0) {
      const anonEnumName = toClassName(en + "Enum", state.reservedWords);
      const enumCode = generateEnumCode(anonEnumName, enumValues);
      state.generatedEnums.set(anonEnumName, enumCode);
      unit.deps.add(anonEnumName);
      return anonEnumName;
    } else {
      const base = (rest as XmldomElement).getAttribute("base");
      return typeMapping(base || "string");
    }
  } else {
    const union = getChildByLocalName(
      inlineST as any,
      "union",
      state.xsdPrefix
    );
    if (union) {
      return handleInlineUnion(union);
    }
  }

  return "any";
}

/**
 * Handles inline union types within a simpleType.
 * Generates TypeScript union types from XSD union member types.
 *
 * @param union - The XSD union element
 * @returns A TypeScript union type string (e.g., "string | number")
 */
function handleInlineUnion(union: XmldomElement): string {
  let memberTypes: string[] = [];
  const memberTypesAttr = union.getAttribute("memberTypes");
  if (memberTypesAttr) {
    memberTypes = memberTypesAttr
      .split(/\s+/)
      .map(localName)
      .filter((t): t is string => !!t);
  }
  const inlineMembers = getChildrenByLocalName(union, "simpleType", "");
  memberTypes.push(...inlineMembers.map(() => "string"));
  if (memberTypes.length > 0) {
    return memberTypes.map(typeMapping).join(" | ");
  }
  return "any";
}

/**
 * Emits the @XmlElement decorator and property declaration for an element.
 * Handles decorator options (type, array, nillable, namespace) and property optionality.
 *
 * @param en - The XML element name
 * @param tsType - The TypeScript type for the property
 * @param isArray - Whether the property is an array
 * @param nillable - Whether the element can be nil
 * @param ens - The XML namespace for the element (optional)
 * @param lines - The output lines array
 * @param state - The generator state
 * @param makeRequired - Whether the property should be non-optional (use ! instead of ?)
 */
function emitElementDecorator(
  en: string,
  tsType: string,
  isArray: boolean,
  nillable: boolean,
  ens: string | undefined,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  makeRequired: boolean
): void {
  const propName = toPropertyName(en, state.reservedWords);
  
  // Check if this property name has already been emitted to avoid duplicates
  if (isPropertyAlreadyEmitted(propName, lines)) {
    return;
  }
  
  const decoratorOpts: string[] = [];

  // Don't include type in decorator if it's a self-reference (to avoid "used before declaration" error)
  const isSelfReference = tsType === unit.className;
  if (
    tsType &&
    tsType !== "any" &&
    /^[A-Za-z0-9_]+$/.test(tsType) &&
    !isSelfReference
  ) {
    decoratorOpts.push(`type: ${tsType}`);
  }
  if (isArray) decoratorOpts.push("array: true");
  if (nillable) decoratorOpts.push("nillable: true");
  if (ens) decoratorOpts.push(`namespace: '${ens}'`);

  const decoratorBody = decoratorOpts.length
    ? `{ ${decoratorOpts.join(", ")} }`
    : "";
  lines.push(
    decoratorBody
      ? `  @XmlElement('${en}', ${decoratorBody})`
      : `  @XmlElement('${en}')`
  );
  lines.push(
    `  ${propName}${makeRequired ? "!" : "?"}: ${tsType}${isArray ? "[]" : ""};`
  );
  lines.push("");
}
