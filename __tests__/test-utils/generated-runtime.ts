import path from "path";
import { mkdirSync, writeFileSync } from "fs";
import { generateFromXsd } from "../../src/xsd/TsGenerator";

let tsNodeRegistered = false;

/**
 * Registers ts-node (once), generates .ts files from provided XSD strings into outDir,
 * and creates a local stub for '@neumaennl/xmlbind-ts' so generated files can resolve decorators.
 */
export function setupGeneratedRuntime(outDir: string, xsds: string[]): void {
  if (!tsNodeRegistered) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("ts-node/register/transpile-only");
    tsNodeRegistered = true;
  }

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

  // CommonJS stub that re-exports decorators from project source
  writeFileSync(
    path.join(stubPkgDir, "package.json"),
    JSON.stringify(
      { name: "@neumaennl/xmlbind-ts", main: "index.js" },
      null,
      2
    ),
    "utf8"
  );
  writeFileSync(
    path.join(stubPkgDir, "index.js"),
    "const XmlRoot = require('" +
      projectRoot +
      "/src/decorators/XmlRoot.ts').XmlRoot;\n" +
      "const XmlElement = require('" +
      projectRoot +
      "/src/decorators/XmlElement.ts').XmlElement;\n" +
      "const XmlAttribute = require('" +
      projectRoot +
      "/src/decorators/XmlAttribute.ts').XmlAttribute;\n" +
      "const XmlText = require('" +
      projectRoot +
      "/src/decorators/XmlText.ts').XmlText;\n" +
      "module.exports = { XmlRoot, XmlElement, XmlAttribute, XmlText };\n",
    "utf8"
  );
  writeFileSync(
    path.join(stubPkgDir, "index.d.ts"),
    "export const XmlRoot: any;\nexport const XmlElement: any;\nexport const XmlAttribute: any;\nexport const XmlText: any;\n",
    "utf8"
  );
}

/**
 * Loads generated classes by name from outDir and returns a map of { ClassName: ctor }.
 */
export function loadGeneratedClasses<T extends string>(
  outDir: string,
  names: T[]
): Record<T, any> {
  const loaded = {} as Record<T, any>;
  for (const n of names) {
    const file = path.join(outDir, `${n}.ts`);
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(file);
      loaded[n] = mod[n];
      if (!loaded[n]) {
        throw new Error(`Export ${n} not found in ${file}`);
      }
    } catch (e: any) {
      const hint = e?.message || String(e);
      throw new Error(
        `Failed to load generated class ${n} from ${file}: ${hint}`
      );
    }
  }
  return loaded;
}
