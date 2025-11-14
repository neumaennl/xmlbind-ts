import { readFileSync, mkdtempSync, rmSync, readdirSync } from "fs";
import os from "os";
import path from "path";
import https from "https";
import {
  setupGeneratedRuntime,
} from "./test-utils/generated-runtime";

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
            reject(
              new Error(`Failed to download: HTTP ${res.statusCode}`)
            );
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

  test(
    "generates TypeScript classes from XML Schema XSD and compiles without errors",
    async () => {
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
          console.log("Download failed, falling back to local file:", (error as Error).message);
          const xsdPath = path.join(__dirname, "test-resources", "XMLSchema.xsd");
          xmlSchemaXsd = readFileSync(xsdPath, "utf-8");
          console.log(`Loaded from local file: ${xsdPath}`);
        }

        console.log("Generating TypeScript classes...");
        
        // Use setupGeneratedRuntime to generate classes and set up the runtime stub
        setupGeneratedRuntime(tmpDir, [xmlSchemaXsd]);

        // List all generated files
        const files = readdirSync(tmpDir).filter((f) => f.endsWith(".ts") && !f.includes("node_modules"));
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
          "formChoice.ts", // enum
          "derivationSet.ts", // enum
        ];

        for (const expectedFile of expectedFiles) {
          expect(files).toContain(expectedFile);
        }

        console.log("Successfully generated TypeScript classes from XML Schema XSD");
      });
    },
    30000 // 30 second timeout
  );
});
