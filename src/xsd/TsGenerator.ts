import { parseXsd, getSchemaRoot, getXsdPrefix } from "./XsdParser";
import { mkdirSync, existsSync } from "fs";
import { indexSchema } from "./tsgen/schema";
import { generateEnumTypes, processSimpleTypes } from "./tsgen/simpletypes";
import { ensureClass } from "./tsgen/classgen";
import { processTopLevelElements } from "./tsgen/toplevel";
import { writeGeneratedFiles } from "./tsgen/writer";
import { toClassName } from "./tsgen/codegen";
import type { GeneratorState } from "./tsgen/codegen";

/**
 * Returns a set of JavaScript/TypeScript reserved words and common built-in types.
 * These words need special handling to avoid naming conflicts in generated code.
 *
 * @returns A Set containing all reserved keywords and built-in type names
 */
function getReservedWords(): Set<string> {
  return new Set([
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "enum",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "function",
    "if",
    "import",
    "in",
    "instanceof",
    "new",
    "null",
    "return",
    "super",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "with",
    "as",
    "implements",
    "interface",
    "let",
    "package",
    "private",
    "protected",
    "public",
    "static",
    "yield",
    "any",
    "boolean",
    "constructor",
    "declare",
    "get",
    "module",
    "require",
    "number",
    "set",
    "string",
    "symbol",
    "type",
    "from",
    "of",
  ]);
}

/**
 * Generates TypeScript classes and types from an XSD schema definition.
 *
 * This is the main entry point for XSD-to-TypeScript code generation. It parses the XSD,
 * processes all schema components (enums, simple types, complex types, and elements),
 * and writes the generated TypeScript files to the specified output directory.
 *
 * @param xsdText - The XSD schema content as a string
 * @param outDir - The output directory path where generated TypeScript files will be written
 * @throws {Error} If the XSD schema is invalid or missing a schema root element
 */
export function generateFromXsd(xsdText: string, outDir: string): void {
  const doc = parseXsd(xsdText);
  const schema = getSchemaRoot(doc);
  if (!schema) throw new Error("No schema");

  const xsdPrefix = getXsdPrefix(schema);
  const schemaContext = indexSchema(schema, xsdPrefix);

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const reservedWords = getReservedWords();
  const generatedEnums = new Map<string, string>();
  const generated = new Map<string, any>();

  const state: GeneratorState = {
    schemaContext,
    xsdPrefix,
    reservedWords,
    generatedEnums,
    generated,
  };

  // Generate enum types
  generateEnumTypes(schemaContext.enumTypesMap, generatedEnums);

  // Process unions and lists for named simpleTypes
  processSimpleTypes(schemaContext, xsdPrefix, generatedEnums, reservedWords);

  // Generate classes for all named complexTypes
  for (const [name, ct] of schemaContext.complexTypesMap.entries()) {
    const className = toClassName(name, reservedWords);
    ensureClass(className, ct, state, name);
  }

  // Generate classes from top-level elements
  processTopLevelElements(schemaContext.topLevelElements, state, ensureClass);

  // Write all generated files
  writeGeneratedFiles(generated, generatedEnums, outDir);
}
