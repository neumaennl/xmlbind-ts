import type { Element as XmldomElement } from "@xmldom/xmldom";
import { localName, getChildByLocalName, getChildrenByLocalName, formatTsDoc } from "./utils";
import { typeMapping, sanitizeTypeName, isPrimitiveTypeName } from "./types";
import { toClassName, toPropertyName } from "./codegen";
import type { GeneratorState, GenUnit } from "./codegen";
import { extractEnumValues, generateEnumCode } from "./enum";

/**
 * Resolves an XSD type reference for an element to a TypeScript type.
 * Handles enums, built-in types, and user-defined types.
 *
 * @param typeAttr - The XSD type attribute value
 * @param unit - The generation unit for tracking dependencies
 * @param state - The generator state
 * @returns The TypeScript type name
 */
export function resolveElementType(
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
export function handleInlineType(
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
 * @param unit - The generation unit
 * @param state - The generator state
 * @param makeRequired - Whether the property should be non-optional (use ! instead of ?)
 */
export function emitElementDecorator(
  en: string,
  tsType: string,
  isArray: boolean,
  nillable: boolean,
  ens: string | undefined,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  makeRequired: boolean,
  doc?: string
): void {
  const propName = toPropertyName(en, state.reservedWords);
  const decoratorOpts: string[] = [];

  // Don't include type in decorator if it's a self-reference (to avoid "used before declaration" error)
  const isSelfReference = tsType === unit.className;

  if (
    tsType &&
    tsType !== "any" &&
    /^[A-Za-z0-9_]+$/.test(tsType) &&
    !isSelfReference
  ) {
    // Use lazy type reference (arrow function) for non-primitive types to avoid circular dependency issues
    if (isPrimitiveTypeName(tsType)) {
      decoratorOpts.push(`type: ${tsType}`);
    } else {
      decoratorOpts.push(`type: () => ${tsType}`);
    }
  }
  if (isArray) decoratorOpts.push("array: true");
  if (nillable) decoratorOpts.push("nillable: true");
  if (ens) decoratorOpts.push(`namespace: '${ens}'`);

  const decoratorBody = decoratorOpts.length
    ? `{ ${decoratorOpts.join(", ")} }`
    : "";
  // Emit documentation comment if present
  if (doc) {
    lines.push(...formatTsDoc(doc, "  "));
  }
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
