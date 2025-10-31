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
  for (const [name, unit] of generated.entries()) {
    writeClassFile(name, unit, outDir);
  }

  for (const [name, enumCode] of generatedEnums.entries()) {
    writeEnumFile(name, enumCode, outDir);
  }
}

/**
 * Writes a single TypeScript class file with appropriate imports.
 *
 * Automatically detects which decorators are used and only imports those.
 * Adds import statements for dependent types.
 *
 * @param name - The class name (used for filename)
 * @param unit - The generation unit containing code lines and dependencies
 * @param outDir - The output directory path
 */
function writeClassFile(name: string, unit: GenUnit, outDir: string): void {
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
  const file = join(outDir, name + ".ts");
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
