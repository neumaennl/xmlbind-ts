import type { Element as XmldomElement } from "@xmldom/xmldom";
import {
  localName,
  getChildByLocalName,
  getChildrenByLocalName,
} from "./utils";
import { typeMapping, sanitizeTypeName, isPrimitiveTypeName } from "./types";
import { generateEnumCode, extractEnumValues } from "./enum";
import { toClassName } from "./codegen";
import type { SchemaContext } from "./schema";

/**
 * Adds an import statement for a referenced enum type when needed.
 *
 * Type aliases are consolidated into a single file, so only enums require
 * explicit imports from the shared enums file.
 *
 * @param typeName - The referenced type name
 * @param generatedEnums - Map containing generated enum and type alias code
 * @param imports - Mutable array collecting import statements
 */
function addEnumImportIfNeeded(
  typeName: string,
  generatedEnums: Map<string, string>,
  imports: string[]
): void {
  if (isPrimitiveTypeName(typeName)) return;
  const generated = generatedEnums.get(typeName);
  if (generated && /export\s+enum/.test(generated)) {
    imports.push(`import { ${typeName} } from './enums';`);
  }
}

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

    // Skip if this is already an enum type
    if (schemaContext.enumTypesMap.has(name)) {
      continue;
    }

    const union = getChildByLocalName(st, "union", xsdPrefix);
    if (union) {
      processUnion(union, typeName, xsdPrefix, generatedEnums);
      continue;
    }

    const list = getChildByLocalName(st, "list", xsdPrefix);
    if (list) {
      processList(list, typeName, generatedEnums);
      continue;
    }

    // Handle restriction-based simpleTypes that aren't enums
    const restriction = getChildByLocalName(st, "restriction", xsdPrefix);
    if (restriction) {
      processRestriction(restriction, typeName, generatedEnums);
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
  const memberTypes: string[] = [];
  const imports: string[] = [];

  if (memberTypesAttr) {
    const memberTypesFromAttr = memberTypesAttr
      .split(/\s+/)
      .map(localName)
      .filter((t): t is string => !!t);

    for (const memberType of memberTypesFromAttr) {
      const mapped = typeMapping(memberType);
      addEnumImportIfNeeded(mapped, generatedEnums, imports);
      memberTypes.push(mapped);
    }
  }

  const inlineMembers = getChildrenByLocalName(union, "simpleType", xsdPrefix);

  for (const inline of inlineMembers) {
    const restriction = getChildByLocalName(inline, "restriction", xsdPrefix);
    if (restriction) {
      const enumValues = extractEnumValues(restriction, xsdPrefix);
      if (enumValues.length > 0) {
        for (const value of enumValues) {
          memberTypes.push(JSON.stringify(value));
        }
        continue;
      }

      const base = restriction.getAttribute("base");
      if (base) {
        const mappedBase = typeMapping(base);

        addEnumImportIfNeeded(mappedBase, generatedEnums, imports);

        memberTypes.push(mappedBase);
        continue;
      }
    }

    const list = getChildByLocalName(inline, "list", xsdPrefix);
    if (list) {
      const itemType = list.getAttribute("itemType");
      if (itemType) {
        const mappedItemType = typeMapping(itemType);

        addEnumImportIfNeeded(mappedItemType, generatedEnums, imports);

        memberTypes.push(`${mappedItemType}[]`);
      } else {
        memberTypes.push("string[]");
      }
      continue;
    }

    memberTypes.push("string");
  }

  if (memberTypes.length > 0) {
    const uniqueMemberTypes = Array.from(new Set(memberTypes));
    const uniqueImports = Array.from(new Set(imports));
    const tsType = uniqueMemberTypes.join(" | ");
    const importLines =
      uniqueImports.length > 0 ? uniqueImports.join("\n") + "\n" : "";
    generatedEnums.set(
      typeName,
      `${importLines}export type ${typeName} = ${tsType};`
    );
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
    const itemLocal = localName(itemType);
    const tsType = typeMapping(itemType);

    const imports: string[] = [];
    if (itemLocal && tsType === sanitizeTypeName(itemLocal)) {
      addEnumImportIfNeeded(tsType, generatedEnums, imports);
    }

    const importLine = imports.length > 0 ? `${imports.join("\n")}\n` : "";
    generatedEnums.set(
      typeName,
      `${importLine}export type ${typeName} = ${tsType}[];`
    );
  } else {
    generatedEnums.set(typeName, `export type ${typeName} = string[];`);
  }
}

/**
 * Processes an XSD restriction type, generating a TypeScript type alias.
 * Creates an alias to the base type for restrictions that aren't enumerations.
 *
 * @param restriction - The XSD restriction element
 * @param typeName - The TypeScript type name
 * @param generatedEnums - Map to store the generated type alias
 */
function processRestriction(
  restriction: XmldomElement,
  typeName: string,
  generatedEnums: Map<string, string>
): void {
  const base = restriction.getAttribute("base");
  if (base) {
    const baseLocal = localName(base);
    const tsType = typeMapping(base);

    const imports: string[] = [];
    if (baseLocal && tsType === sanitizeTypeName(baseLocal)) {
      addEnumImportIfNeeded(tsType, generatedEnums, imports);
    }

    const importLine = imports.length > 0 ? `${imports.join("\n")}\n` : "";
    generatedEnums.set(
      typeName,
      `${importLine}export type ${typeName} = ${tsType};`
    );
  } else {
    // No base specified, default to string
    generatedEnums.set(typeName, `export type ${typeName} = string;`);
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
