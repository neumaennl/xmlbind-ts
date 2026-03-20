import type { Element as XmldomElement } from "@xmldom/xmldom";
import {
  localName,
  getChildByLocalName,
  getChildrenByLocalName,
  formatTsDoc,
} from "./utils";
import {
  typeMapping,
  sanitizeTypeName,
  isPrimitiveTypeName,
  toDecoratorType,
} from "./types";
import { toClassName, toPropertyName } from "./codegen";
import type { GeneratorState, GenUnit } from "./codegen";
import { extractEnumValues, generateEnumCode } from "./enum";
import { computeDecoratorType, needsAllowStringFallback } from "./decorator-type-helpers";

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
      tsType !== "string" &&
      tsType !== "number" &&
      tsType !== "boolean" &&
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
      state.generatedSimpleTypes.set(anonEnumName, enumCode);
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
 * Builds the `@XmlElement(...)` decorator line for code generation.
 *
 * This is the single source of truth for element decorator emission, used by both
 * `emitElementDecorator` and `emitElementRef` to avoid code duplication.
 *
 * Type option rules (mirrors the attribute helper):
 * - Primitives with coercion needs (`number`, `boolean`, `Date`) → constructor directly, e.g. `type: Number`.
 * - Union type aliases containing `number`/`boolean` → constructor + `allowStringFallback: true`,
 *   e.g. `type: Number, allowStringFallback: true`.
 * - `string` and other simple primitives → constructor directly, e.g. `type: String`.
 * - Complex class types → lazy arrow-function reference, e.g. `type: () => MyClass`.
 * - `any`, `unknown`, or types containing non-identifier characters → no type option.
 *
 * @param elName - The XML element name
 * @param tsType - The resolved TypeScript type name
 * @param isArray - Whether this is an array element
 * @param nillable - Whether the element can be nil
 * @param ens - Optional XML namespace URI for the element
 * @param state - The generator state (used to look up union type aliases)
 * @returns The decorator line string (e.g. `  @XmlElement('count', { type: Number })`)
 */
export function buildXmlElementDecorator(
  elName: string,
  tsType: string,
  isArray: boolean,
  nillable: boolean,
  ens: string | null | undefined,
  state: GeneratorState
): string {
  const opts: string[] = [];

  if (tsType && tsType !== "any" && tsType !== "unknown" && /^[A-Za-z0-9_]+$/.test(tsType)) {
    const decoratorType = computeDecoratorType(tsType, state);
    if (decoratorType) {
      // Handles: number, boolean, Date, and union aliases containing those types.
      opts.push(`type: ${decoratorType}`);
    } else if (isPrimitiveTypeName(tsType)) {
      // Handles: string → type: String
      opts.push(`type: ${toDecoratorType(tsType)}`);
    } else {
      // Complex class types: use lazy arrow-function reference to avoid circular-import issues.
      opts.push(`type: () => ${tsType}`);
    }
  }

  if (isArray) opts.push("array: true");
  if (nillable) opts.push("nillable: true");
  if (ens) opts.push(`namespace: '${ens}'`);
  if (needsAllowStringFallback(tsType, state)) opts.push("allowStringFallback: true");

  if (opts.length === 0) {
    return `  @XmlElement('${elName}')`;
  }
  return `  @XmlElement('${elName}', { ${opts.join(", ")} })`;
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
  // Emit documentation comment if present
  if (doc) {
    lines.push(...formatTsDoc(doc, "  "));
  }
  lines.push(buildXmlElementDecorator(en, tsType, isArray, nillable, ens, state));
  lines.push(
    `  ${propName}${makeRequired ? "!" : "?"}: ${tsType}${isArray ? "[]" : ""};`
  );
  lines.push("");
}
