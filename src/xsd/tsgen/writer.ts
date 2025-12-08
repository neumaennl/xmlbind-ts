import { writeFileSync } from "fs";
import { join } from "path";
import type { GenUnit } from "./codegen";

/**
 * Writes all generated TypeScript class and enum files to the output directory.
 * Groups simple types and enums into consolidated files to reduce file count.
 *
 * @param generated - Map of class names to their generation units
 * @param generatedEnums - Map of enum names to their generated code
 * @param outDir - The output directory path
 */
export function writeGeneratedFiles(
  generated: Map<string, GenUnit>,
  generatedEnums: Map<string, string>,
  outDir: string
): void {
  // Track used filenames (case-insensitive) to prevent collisions
  const usedFilenames = new Map<string, string>(); // lowercase -> actual name
  const allExports: string[] = [];

  // Separate enums/types by category
  const enums: Array<[string, string]> = [];
  const typeAliases: Array<[string, string]> = [];
  const typeNames = new Set<string>();
  const enumNames = new Set<string>();

  for (const [name, enumCode] of generatedEnums.entries()) {
    const isTypeAlias = /\bexport\s+type\b/.test(enumCode);
    if (isTypeAlias) {
      typeAliases.push([name, enumCode]);
      typeNames.add(name);
    } else {
      enums.push([name, enumCode]);
      enumNames.add(name);
    }
  }

  // Write consolidated types.ts file if there are any type aliases
  if (typeAliases.length > 0) {
    writeConsolidatedTypes(typeAliases, outDir);
    for (const [name] of typeAliases) {
      allExports.push(`export type { ${name} } from './types';`);
    }
  }

  // Write consolidated enums.ts file if there are any enums
  if (enums.length > 0) {
    writeConsolidatedEnums(enums, outDir);
    for (const [name] of enums) {
      allExports.push(`export { ${name} } from './enums';`);
    }
  }

  // Write individual class files - these need separate files due to complex dependencies
  for (const [name, unit] of generated.entries()) {
    const filename = resolveFilename(name, usedFilenames);
    writeClassFile(name, filename, unit, outDir, typeNames, enumNames);
    allExports.push(`export { ${name} } from './${filename}';`);
  }

  // Write barrel export file
  writeBarrelExport(allExports, outDir);
}

/**
 * Resolves a filename, handling case-insensitive collisions by appending a suffix.
 *
 * @param name - The type name
 * @param usedFilenames - Map of lowercase filenames to actual names
 * @returns The resolved filename (without extension)
 */
function resolveFilename(
  name: string,
  usedFilenames: Map<string, string>
): string {
  const lowerName = name.toLowerCase();

  // If no collision, use the name as-is
  if (!usedFilenames.has(lowerName)) {
    usedFilenames.set(lowerName, name);
    return name;
  }

  // If exact match (same case), use it
  if (usedFilenames.get(lowerName) === name) {
    return name;
  }

  // Collision with different case - append suffix
  let suffix = 2;
  while (usedFilenames.has(`${lowerName}${suffix}`)) {
    suffix++;
  }
  const resolvedName = `${name}${suffix}`;
  usedFilenames.set(`${lowerName}${suffix}`, resolvedName);
  return resolvedName;
}

/**
 * Writes a single TypeScript class file with appropriate imports.
 *
 * Automatically detects which decorators are used and only imports those.
 * Adds import statements for dependent types, importing from consolidated files when appropriate.
 *
 * @param name - The class name (used in code)
 * @param filename - The filename to use (may differ from name to avoid collisions)
 * @param unit - The generation unit containing code lines and dependencies
 * @param outDir - The output directory path
 * @param typeNames - Set of type alias names (for importing from types.ts)
 * @param enumNames - Set of enum names (for importing from enums.ts)
 */
function writeClassFile(
  name: string,
  filename: string,
  unit: GenUnit,
  outDir: string,
  typeNames: Set<string>,
  enumNames: Set<string>
): void {
  const usedLines = unit.lines;

  // Dynamically detect which decorators are actually used
  const decorators = [
    "XmlRoot",
    "XmlElement",
    "XmlAttribute",
    "XmlText",
    "XmlEnum",
    "XmlAnyElement",
    "XmlAnyAttribute",
  ];

  const importNames = decorators.filter((decorator) =>
    usedLines.some((l) => l.includes(`@${decorator}(`))
  );

  const lines: string[] = [];

  // Only add import if decorators are actually used
  if (importNames.length > 0) {
    lines.push(
      `import { ${importNames.join(", ")} } from '@neumaennl/xmlbind-ts';`
    );
  }

  // Group dependencies by source file
  const typeDeps: string[] = [];
  const enumDeps: string[] = [];
  const classDeps: string[] = [];

  for (const dep of unit.deps) {
    if (dep === name) continue;

    if (typeNames.has(dep)) {
      typeDeps.push(dep);
    } else if (enumNames.has(dep)) {
      enumDeps.push(dep);
    } else {
      classDeps.push(dep);
    }
  }

  // Import type aliases from types.ts
  if (typeDeps.length > 0) {
    lines.push(`import type { ${typeDeps.sort().join(", ")} } from './types';`);
  }

  // Import enums from enums.ts
  if (enumDeps.length > 0) {
    lines.push(`import { ${enumDeps.sort().join(", ")} } from './enums';`);
  }

  // Import classes from individual files
  for (const dep of classDeps) {
    lines.push(`import { ${dep} } from './${dep}';`);
  }

  lines.push(...usedLines);

  const code = lines.join("\n");
  const file = join(outDir, filename + ".ts");
  writeFileSync(file, code, "utf8");
  console.log("Wrote", file);
}

/**
 * Writes a consolidated types.ts file containing all type aliases.
 *
 * @param typeAliases - Array of [name, code] tuples for type aliases
 * @param outDir - The output directory path
 */
function writeConsolidatedTypes(
  typeAliases: Array<[string, string]>,
  outDir: string
): void {
  const sortedTypes = [...typeAliases].sort((a, b) => a[0].localeCompare(b[0]));

  const importLines = new Set<string>();
  const aliasBodies: string[] = [];

  for (const [, code] of sortedTypes) {
    const lines = code.split("\n");
    const body: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("import ")) {
        importLines.add(trimmed);
        continue;
      }
      body.push(line);
    }

    aliasBodies.push(body.join("\n").trimEnd());
  }

  const content = [
    "// Auto-generated type aliases",
    "// This file is generated by xmlbind-ts XSD generator",
    "",
    ...Array.from(importLines),
    ...(importLines.size > 0 ? [""] : []),
    ...aliasBodies,
    "",
  ].join("\n");

  const file = join(outDir, "types.ts");
  writeFileSync(file, content, "utf8");
  console.log("Wrote", file);
}

/**
 * Writes a consolidated enums.ts file containing all enum declarations.
 *
 * @param enums - Array of [name, code] tuples for enums
 * @param outDir - The output directory path
 */
function writeConsolidatedEnums(
  enums: Array<[string, string]>,
  outDir: string
): void {
  const sortedEnums = [...enums].sort((a, b) => a[0].localeCompare(b[0]));

  const content = [
    "// Auto-generated enumerations",
    "// This file is generated by xmlbind-ts XSD generator",
    "",
    ...sortedEnums.map(([, code]) => code),
    "",
  ].join("\n");

  const file = join(outDir, "enums.ts");
  writeFileSync(file, content, "utf8");
  console.log("Wrote", file);
}

/**
 * Writes a barrel export file (index.ts) that re-exports all generated types.
 *
 * @param exports - Array of export statements
 * @param outDir - The output directory path
 */
function writeBarrelExport(exports: string[], outDir: string): void {
  const content = [
    "// Auto-generated barrel export for all generated types",
    "// This file is generated by xmlbind-ts XSD generator",
    "",
    ...exports.sort(),
    "",
  ].join("\n");

  const file = join(outDir, "index.ts");
  writeFileSync(file, content, "utf8");
  console.log("Wrote", file);
}
