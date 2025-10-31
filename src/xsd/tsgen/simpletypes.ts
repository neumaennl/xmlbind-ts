import type { Element as XmldomElement } from "@xmldom/xmldom";
import {
  localName,
  getChildByLocalName,
  getChildrenByLocalName,
} from "./utils";
import { typeMapping, sanitizeTypeName } from "./types";
import { generateEnumCode } from "./enum";
import { toClassName } from "./codegen";
import type { SchemaContext } from "./schema";

/**
 * Processes all named simple types in the schema, generating unions and lists.
 *
 * Iterates through simpleTypes and creates TypeScript type aliases for
 * xs:union and xs:list constructs.
 *
 * @param schemaContext - The indexed schema context
 * @param xsdPrefix - The XSD namespace prefix
 * @param generatedEnums - Map to store generated type aliases
 * @param reservedWords - Set of reserved keywords
 */
export function processSimpleTypes(
  schemaContext: SchemaContext,
  xsdPrefix: string,
  generatedEnums: Map<string, string>,
  reservedWords: Set<string>
): void {
  for (const [name, st] of schemaContext.simpleTypesMap.entries()) {
    const typeName = toClassName(name, reservedWords);

    const union = getChildByLocalName(st, "union", xsdPrefix);
    if (union) {
      processUnion(union, typeName, xsdPrefix, generatedEnums);
    }

    const list = getChildByLocalName(st, "list", xsdPrefix);
    if (list) {
      processList(list, typeName, generatedEnums);
    }
  }
}

/**
 * Processes an XSD union type, generating a TypeScript union type alias.
 *
 * @param union - The XSD union element
 * @param typeName - The TypeScript type name
 * @param xsdPrefix - The XSD namespace prefix
 * @param generatedEnums - Map to store the generated type alias
 */
function processUnion(
  union: XmldomElement,
  typeName: string,
  xsdPrefix: string,
  generatedEnums: Map<string, string>
): void {
  const memberTypesAttr = union.getAttribute("memberTypes");
  let memberTypes: string[] = [];

  if (memberTypesAttr) {
    memberTypes = memberTypesAttr
      .split(/\s+/)
      .map(localName)
      .filter((t): t is string => !!t);
  }

  const inlineMembers = getChildrenByLocalName(union, "simpleType", xsdPrefix);
  memberTypes.push(...inlineMembers.map(() => "string"));

  if (memberTypes.length > 0) {
    const tsType = memberTypes.map(typeMapping).join(" | ");
    generatedEnums.set(typeName, `export type ${typeName} = ${tsType};`);
  }
}

/**
 * Processes an XSD list type, generating a TypeScript array type alias.
 *
 * @param list - The XSD list element
 * @param typeName - The TypeScript type name
 * @param generatedEnums - Map to store the generated type alias
 */
function processList(
  list: XmldomElement,
  typeName: string,
  generatedEnums: Map<string, string>
): void {
  const itemType = list.getAttribute("itemType");
  if (itemType) {
    const tsType = typeMapping(itemType);
    generatedEnums.set(typeName, `export type ${typeName} = ${tsType}[];`);
  } else {
    generatedEnums.set(typeName, `export type ${typeName} = string[];`);
  }
}

/**
 * Generates TypeScript enum declarations for all enumeration types.
 *
 * @param enumTypesMap - Map of enum names to their value arrays
 * @param generatedEnums - Map to store the generated enum code
 */
export function generateEnumTypes(
  enumTypesMap: Map<string, string[]>,
  generatedEnums: Map<string, string>
): void {
  for (const [name, values] of enumTypesMap.entries()) {
    const enumCode = generateEnumCode(name, values);
    const sanitizedName = sanitizeTypeName(name);
    generatedEnums.set(sanitizedName, enumCode);
  }
}
