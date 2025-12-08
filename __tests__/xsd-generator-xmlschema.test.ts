import { readFileSync, readdirSync, writeFileSync } from "fs";

import path from "path";
import { withTmpDir } from "./test-utils/temp-dir";
import { execSync } from "child_process";
import { setupGeneratedRuntime } from "./test-utils/generated-runtime";

describe("XSD Generator - XML Schema XSD", () => {
  test("generates TypeScript classes from XML Schema XSD and verifies compilation", () => {
    withTmpDir((tmpDir) => {
      // Load the XML Schema XSD from local test resources
      const xsdPath = path.join(__dirname, "test-resources", "XMLSchema.xsd");
      const xmlSchemaXsd = readFileSync(xsdPath, "utf-8");
      console.log(`Loaded XMLSchema.xsd from ${xsdPath}`);

      console.log("Generating TypeScript classes...");

      // Use setupGeneratedRuntime to generate classes and set up the runtime stub
      setupGeneratedRuntime(tmpDir, [xmlSchemaXsd]);

      // List all generated files
      const files = readdirSync(tmpDir).filter(
        (f) => f.endsWith(".ts") && !f.includes("node_modules")
      );
      console.log(`Generated ${files.length} TypeScript files`);

      // Verify some expected files were generated
      expect(files.length).toBeGreaterThan(0);

      // Check that specific expected types exist
      const expectedFiles = [
        "schema.ts",
        "element.ts",
        "attribute.ts",
        "complexType.ts",
        "simpleType.ts",
        "enums.ts", // consolidated enums file
        "types.ts", // consolidated types file
        "index.ts", // barrel export
      ];

      for (const expectedFile of expectedFiles) {
        expect(files).toContain(expectedFile);
      }

      // Verify enums are in the consolidated enums.ts file
      const enumsContent = readFileSync(path.join(tmpDir, "enums.ts"), "utf8");
      expect(enumsContent).toContain("export enum formChoice");
      expect(enumsContent).not.toContain("enum derivationSet");

      const typesContent = readFileSync(path.join(tmpDir, "types.ts"), "utf8");
      expect(typesContent).toContain("export type derivationSet");

      console.log(
        "Successfully generated TypeScript classes from XML Schema XSD"
      );

      // Verify that generated files compile successfully
      console.log("Verifying TypeScript compilation...");

      // Create a tsconfig.json for compilation
      const tsConfig = {
        compilerOptions: {
          target: "ES2020",
          module: "commonjs",
          lib: ["ES2020"],
          declaration: true,
          outDir: path.join(tmpDir, "dist"),
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          moduleResolution: "node",
          resolveJsonModule: true,
        },
        include: ["*.ts"],
        exclude: ["node_modules", "dist"],
      };

      writeFileSync(
        path.join(tmpDir, "tsconfig.json"),
        JSON.stringify(tsConfig, null, 2)
      );

      // Run TypeScript compiler using the project's installed tsc
      const projectRoot = path.resolve(__dirname, "..");
      const tscPath = path.join(projectRoot, "node_modules", ".bin", "tsc");

      try {
        const output = execSync(`"${tscPath}" --noEmit`, {
          cwd: tmpDir,
          encoding: "utf-8",
        });

        console.log("TypeScript compilation successful!");
        if (output) {
          console.log(output);
        }
      } catch (error: any) {
        const errorOutput = error.stdout || error.stderr || error.message;
        console.error("TypeScript compilation errors:");
        console.error(errorOutput);
        throw error;
      }
    });
  }, 30000); // 30 second timeout
});
