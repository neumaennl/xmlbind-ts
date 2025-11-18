import {
  readFileSync,
  mkdtempSync,
  rmSync,
  readdirSync,
  writeFileSync,
} from "fs";
import os from "os";
import path from "path";
import https from "https";
import { execSync } from "child_process";
import { setupGeneratedRuntime } from "./test-utils/generated-runtime";

describe("XSD Generator - XML Schema XSD", () => {
  async function withTmpDir(run: (dir: string) => Promise<void>) {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "xmlbind-ts-xmlschema-"));
    try {
      await run(tmpDir);
    } finally {
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }

  function downloadFile(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            // Follow redirect
            if (res.headers.location) {
              downloadFile(res.headers.location).then(resolve).catch(reject);
              return;
            }
          }

          if (res.statusCode !== 200) {
            reject(new Error(`Failed to download: HTTP ${res.statusCode}`));
            return;
          }

          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            resolve(data);
          });
        })
        .on("error", reject);
    });
  }

  test("generates TypeScript classes from XML Schema XSD and verifies compilation", async () => {
    await withTmpDir(async (tmpDir) => {
      // Download the official XML Schema XSD from W3C
      console.log("Downloading XMLSchema.xsd from W3C...");
      let xmlSchemaXsd: string;
      try {
        xmlSchemaXsd = await downloadFile(
          "https://www.w3.org/2001/XMLSchema.xsd"
        );
        console.log(`Downloaded ${xmlSchemaXsd.length} bytes from W3C`);
      } catch (error) {
        // Fallback to local file if download fails
        console.log(
          "Download failed, falling back to local file:",
          (error as Error).message
        );
        const xsdPath = path.join(__dirname, "test-resources", "XMLSchema.xsd");
        xmlSchemaXsd = readFileSync(xsdPath, "utf-8");
        console.log(`Loaded from local file: ${xsdPath}`);
      }

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
      expect(enumsContent).toContain("export enum derivationSet");

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
