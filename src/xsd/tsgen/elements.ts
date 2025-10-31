import type { Element as XmldomElement } from "@xmldom/xmldom";
import {
  localName,
  getChildByLocalName,
  getChildrenByLocalName,
} from "./utils";
import { typeMapping, sanitizeTypeName, isBuiltinType } from "./types";
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

    const children = Array.from((container as any).childNodes || []);
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
          ensureClass
        );
      } else if (localN === "group") {
        processGroup(childNode as XmldomElement);
      } else if (localN === "any") {
        ensureAnyElement(lines);
      }
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
 */
export function emitElement(
  e: XmldomElement,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  ensureClass: (name: string, el: XmldomElement, xmlName?: string) => GenUnit
): void {
  const en = e.getAttribute("name");
  const refAttr = e.getAttribute("ref");

  if (refAttr && !en) {
    emitElementRef(e, refAttr, lines, unit, state);
    return;
  }

  if (!en) return;

  const typeAttr = e.getAttribute("type");
  const max = e.getAttribute("maxOccurs") ?? "1";
  const isArray = max === "unbounded" || Number(max) > 1;
  const nillable = e.getAttribute("nillable") === "true";
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

  emitElementDecorator(en, tsType, isArray, nillable, ens, lines, state);
}

function emitElementRef(
  e: XmldomElement,
  refAttr: string,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState
): void {
  const refLocalName = localName(refAttr)!;
  const max = e.getAttribute("maxOccurs") ?? "1";
  const isArray = max === "unbounded" || Number(max) > 1;
  const nillable = e.getAttribute("nillable") === "true";

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
      if (state.schemaContext.enumTypesMap.has(local)) {
        tsType = sanitizeTypeName(local);
        unit.deps.add(sanitizeTypeName(local));
      } else {
        tsType = typeMapping(refType);
        if (!isBuiltinType(refType)) {
          unit.deps.add(sanitizeTypeName(local));
        }
      }
    }

    const propName = toPropertyName(refLocalName, state.reservedWords);
    const decoratorOpts: string[] = [];
    if (tsType && tsType !== "any" && /^[A-Za-z0-9_]+$/.test(tsType)) {
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
    lines.push(`  ${propName}?: ${tsType}${isArray ? "[]" : ""};`);
    lines.push("");
  }
}

function resolveElementType(
  typeAttr: string,
  unit: GenUnit,
  state: GeneratorState
): string {
  const local = localName(typeAttr)!;
  if (state.schemaContext.enumTypesMap.has(local)) {
    const tsType = sanitizeTypeName(local);
    unit.deps.add(tsType);
    return tsType;
  } else {
    const tsType = typeMapping(typeAttr);
    if (!isBuiltinType(typeAttr)) {
      unit.deps.add(sanitizeTypeName(local));
    }
    return tsType;
  }
}

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
    return anonName;
  } else if (inlineST) {
    return handleInlineSimpleType(inlineST, en, unit, state);
  }

  return "any";
}

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

function emitElementDecorator(
  en: string,
  tsType: string,
  isArray: boolean,
  nillable: boolean,
  ens: string | undefined,
  lines: string[],
  state: GeneratorState
): void {
  const propName = toPropertyName(en, state.reservedWords);
  const decoratorOpts: string[] = [];

  if (tsType && tsType !== "any" && /^[A-Za-z0-9_]+$/.test(tsType)) {
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
  lines.push(`  ${propName}?: ${tsType}${isArray ? "[]" : ""};`);
  lines.push("");
}
