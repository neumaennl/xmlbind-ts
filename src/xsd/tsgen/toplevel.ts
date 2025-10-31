import type { Element as XmldomElement } from "@xmldom/xmldom";
import { localName, getChildByLocalName } from "./utils";
import { typeMapping, sanitizeTypeName, isBuiltinType } from "./types";
import { extractEnumValues, generateEnumCode } from "./enum";
import { toClassName } from "./codegen";
import type { GeneratorState, GenUnit } from "./codegen";

/**
 * Processes all top-level element declarations in the schema.
 *
 * Generates wrapper classes for top-level elements that reference types,
 * or generates inline classes for elements with inline type definitions.
 * Handles collision avoidance with existing type names.
 *
 * @param topLevelElements - Array of top-level xs:element definitions
 * @param state - The generator state
 * @param ensureClass - Callback function to ensure a class is generated
 */
export function processTopLevelElements(
  topLevelElements: XmldomElement[],
  state: GeneratorState,
  ensureClass: (
    name: string,
    el: XmldomElement,
    state: GeneratorState,
    xmlName?: string
  ) => GenUnit
): void {
  for (const el of topLevelElements) {
    const en = el.getAttribute("name");
    if (!en) continue;

    const typeAttr = el.getAttribute("type");
    const inlineCT = getChildByLocalName(el, "complexType", state.xsdPrefix);
    const inlineST = getChildByLocalName(el, "simpleType", state.xsdPrefix);

    const hasCollision =
      state.schemaContext.complexTypesMap.has(en) ||
      state.schemaContext.simpleTypesMap.has(en) ||
      state.generated.has(en);
    const baseName = hasCollision ? `${en}Element` : en;
    const className = toClassName(baseName, state.reservedWords);

    if (typeAttr) {
      processElementWithType(className, en, typeAttr, state);
    } else if (inlineCT) {
      ensureClass(className, inlineCT as any, state, en);
    } else if (inlineST) {
      processElementWithInlineSimpleType(className, en, inlineST, state);
    }
  }
}

/**
 * Processes a top-level element that has a type attribute.
 * Creates wrapper or text wrapper classes as appropriate.
 *
 * @param className - The generated class name
 * @param en - The XML element name
 * @param typeAttr - The type attribute value
 * @param state - The generator state
 */
function processElementWithType(
  className: string,
  en: string,
  typeAttr: string,
  state: GeneratorState
): void {
  const local = localName(typeAttr)!;

  if (state.schemaContext.complexTypesMap.has(local)) {
    createWrapperClass(className, en, local, state);
  } else if (state.schemaContext.enumTypesMap.has(local)) {
    createEnumWrapperClass(className, en, local, state);
  } else if (
    state.schemaContext.simpleTypesMap.has(local) ||
    isBuiltinType(typeAttr)
  ) {
    createTextWrapperClass(className, en, typeAttr, state);
  }
}

/**
 * Creates a wrapper class that extends a base complex type.
 * Used when a top-level element references a complex type.
 *
 * @param className - The wrapper class name
 * @param en - The XML element name
 * @param baseType - The base type to extend
 * @param state - The generator state
 */
function createWrapperClass(
  className: string,
  en: string,
  baseType: string,
  state: GeneratorState
): void {
  const unit: GenUnit = { lines: [], deps: new Set([baseType]) };
  state.generated.set(className, unit);

  const prefixObj = getPrefixObject(state);
  unit.lines.push(
    `@XmlRoot('${en}'${
      state.schemaContext.targetNs
        ? `, { namespace: '${state.schemaContext.targetNs}'${prefixObj} }`
        : ""
    })`
  );
  unit.lines.push(
    `export class ${className} extends ${sanitizeTypeName(baseType)} {}`
  );
}

/**
 * Creates a wrapper class for an element with an enum type.
 * Generates a class with a @XmlText property of the enum type.
 *
 * @param className - The wrapper class name
 * @param en - The XML element name
 * @param enumType - The enum type name
 * @param state - The generator state
 */
function createEnumWrapperClass(
  className: string,
  en: string,
  enumType: string,
  state: GeneratorState
): void {
  const enumName = sanitizeTypeName(enumType);
  const unit: GenUnit = { lines: [], deps: new Set([enumName]) };
  state.generated.set(className, unit);

  const prefixObj = getPrefixObject(state);
  unit.lines.push(
    `@XmlRoot('${en}'${
      state.schemaContext.targetNs
        ? `, { namespace: '${state.schemaContext.targetNs}'${prefixObj} }`
        : ""
    })`
  );
  unit.lines.push(`export class ${className} {`);
  unit.lines.push(`  @XmlText()`);
  unit.lines.push(`  value?: ${enumName};`);
  unit.lines.push("}");
}

/**
 * Creates a simple wrapper class for an element with a primitive or simple type.
 * Generates a class with a @XmlText property.
 *
 * @param className - The wrapper class name
 * @param en - The XML element name
 * @param typeAttr - The XSD type
 * @param state - The generator state
 */
function createTextWrapperClass(
  className: string,
  en: string,
  typeAttr: string,
  state: GeneratorState
): void {
  const unit: GenUnit = { lines: [], deps: new Set() };
  state.generated.set(className, unit);

  const tsType = typeMapping(typeAttr);
  const prefixObj = getPrefixObject(state);
  unit.lines.push(
    `@XmlRoot('${en}'${
      state.schemaContext.targetNs
        ? `, { namespace: '${state.schemaContext.targetNs}'${prefixObj} }`
        : ""
    })`
  );
  unit.lines.push(`export class ${className} {`);
  unit.lines.push(`  @XmlText()`);
  unit.lines.push(`  value?: ${tsType};`);
  unit.lines.push("}");
}

/**
 * Processes a top-level element with an inline simpleType definition.
 *
 * @param className - The wrapper class name
 * @param en - The XML element name
 * @param inlineST - The inline simpleType element
 * @param state - The generator state
 */
function processElementWithInlineSimpleType(
  className: string,
  en: string,
  inlineST: XmldomElement,
  state: GeneratorState
): void {
  const rest = getChildByLocalName(
    inlineST as any,
    "restriction",
    state.xsdPrefix
  );

  let tsType: string;
  let isEnum = false;

  if (rest) {
    const enumValues = extractEnumValues(
      rest as XmldomElement,
      state.xsdPrefix
    );
    if (enumValues.length > 0) {
      const anonEnumName = toClassName(en + "Enum", state.reservedWords);
      const enumCode = generateEnumCode(anonEnumName, enumValues);
      state.generatedEnums.set(anonEnumName, enumCode);
      tsType = anonEnumName;
      isEnum = true;
    } else {
      const base = (rest as XmldomElement).getAttribute("base");
      tsType = typeMapping(base || "string");
    }
  } else {
    tsType = "any";
  }

  const unit: GenUnit = {
    lines: [],
    deps: isEnum ? new Set([tsType]) : new Set(),
  };
  state.generated.set(className, unit);

  const prefixObj = getPrefixObject(state);
  unit.lines.push(
    `@XmlRoot('${en}'${
      state.schemaContext.targetNs
        ? `, { namespace: '${state.schemaContext.targetNs}'${prefixObj} }`
        : ""
    })`
  );
  unit.lines.push(`export class ${className} {`);
  unit.lines.push(`  @XmlText()`);
  unit.lines.push(`  value?: ${tsType};`);
  unit.lines.push("}");
}

/**
 * Builds the prefix configuration object string for @XmlRoot decorator.
 *
 * @param state - The generator state
 * @returns The prefixes configuration string, or empty string if no prefixes
 */
function getPrefixObject(state: GeneratorState): string {
  return state.schemaContext.schemaPrefixes.size
    ? `, prefixes: { ${Array.from(state.schemaContext.schemaPrefixes.entries())
        .map(([uri, p]) => `'${uri}': '${p}'`)
        .join(", ")} }`
    : "";
}
