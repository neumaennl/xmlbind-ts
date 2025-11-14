import { writeFileSync } from "fs";
import { join } from "path";
import type { GenUnit } from "./codegen";

/**
 * Writes all generated TypeScript class and enum files to the output directory.
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

  for (const [name, unit] of generated.entries()) {
    const filename = resolveFilename(name, usedFilenames);
    writeClassFile(name, filename, unit, outDir);
  }

  for (const [name, enumCode] of generatedEnums.entries()) {
    const filename = resolveFilename(name, usedFilenames);
    writeEnumFile(filename, enumCode, outDir);
  }
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
 * Adds import statements for dependent types.
 *
 * @param name - The class name (used in code)
 * @param filename - The filename to use (may differ from name to avoid collisions)
 * @param unit - The generation unit containing code lines and dependencies
 * @param outDir - The output directory path
 */
function writeClassFile(
  name: string,
  filename: string,
  unit: GenUnit,
  outDir: string
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

  for (const dep of unit.deps) {
    if (dep === name) continue;
    lines.push(`import { ${dep} } from './${dep}';`);
  }

  lines.push(...usedLines);

  const code = lines.join("\n");
  const file = join(outDir, filename + ".ts");
  writeFileSync(file, code, "utf8");
  console.log("Wrote", file);
}

/**
 * Writes a single TypeScript enum file.
 *
 * @param name - The enum name (used for filename)
 * @param enumCode - The complete enum code
 * @param outDir - The output directory path
 */
function writeEnumFile(name: string, enumCode: string, outDir: string): void {
  const file = join(outDir, name + ".ts");
  writeFileSync(file, enumCode, "utf8");
  console.log("Wrote", file);
}
