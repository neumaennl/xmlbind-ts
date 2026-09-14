import path from "path";
import { mkdirSync, writeFileSync } from "fs";
import { pathToFileURL } from "url";
import { generateFromXsd } from "../../src/xsd/TsGenerator.js";

/**
 * Generates .ts files from provided XSD strings into outDir,
 * and creates a local ESM stub for '@neumaennl/xmlbind-ts' so generated files resolve decorators via Vitest.
 */
export function setupGeneratedRuntime(outDir: string, xsds: string[]): void {
  // Generate .ts files from XSD inputs
  for (const xsd of xsds) {
    generateFromXsd(xsd, outDir);
  }

  // Provide a temp node_modules to resolve '@neumaennl/xmlbind-ts'
  const stubPkgDir = path.join(
    outDir,
    "node_modules",
    "@neumaennl",
    "xmlbind-ts"
  );
  mkdirSync(stubPkgDir, { recursive: true });

  const projectRoot = process.cwd();
  const srcIndexPath = path.join(projectRoot, "src", "index.ts");
  const relPath = path.relative(stubPkgDir, srcIndexPath).replace(/\\/g, "/");

  writeFileSync(
    path.join(stubPkgDir, "package.json"),
    JSON.stringify(
      { name: "@neumaennl/xmlbind-ts", type: "module", main: "index.js" },
      null,
      2
    ),
    "utf8"
  );
  writeFileSync(
    path.join(stubPkgDir, "index.js"),
    `export * from "${relPath}";\n`,
    "utf8"
  );
  writeFileSync(
    path.join(stubPkgDir, "index.d.ts"),
    "export const XmlRoot: any;\nexport const XmlElement: any;\nexport const XmlAttribute: any;\nexport const XmlText: any;\nexport const XmlAnyElement: any;\nexport const XmlAnyAttribute: any;\n",
    "utf8"
  );
}

/**
 * Loads generated classes by name from outDir using Vitest's dynamic module import.
 */
export async function loadGeneratedClasses<T extends string>(
  outDir: string,
  names: T[]
): Promise<Record<T, any>> {
  const loaded = {} as Record<T, any>;
  for (const n of names) {
    const file = path.join(outDir, `${n}.ts`);
    try {
      const fileUrl = pathToFileURL(file).href;
      const mod = await import(fileUrl);
      loaded[n] = mod[n];
      if (!loaded[n]) {
        throw new Error(`Export ${n} not found in ${file}`);
      }
    } catch (e: any) {
      const hint = e?.message || String(e);
      throw new Error(
        `Failed to load generated class ${n} from ${file}: ${hint}`,
        { cause: e }
      );
    }
  }
  return loaded;
}
