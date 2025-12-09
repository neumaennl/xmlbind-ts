/**
 * Integration tests for the CLI tool (xsd2ts).
 *
 * These tests run the CLI as a subprocess via ts-node, which provides
 * end-to-end testing but doesn't contribute to code coverage metrics.
 * The CLI is a thin wrapper that orchestrates fileCleanup and generateFromXsd,
 * both of which have dedicated unit tests with high coverage.
 *
 * Coverage for the CLI module's core logic is provided by:
 * - file-cleanup.test.ts: Tests fileCleanup.ts (100% statement coverage)
 * - xsd-generator*.test.ts: Tests generateFromXsd and related functions
 */
import { execSync } from "child_process";
import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
} from "fs";
import os from "os";
import path from "path";

const SAMPLE_XSD = `<?xml version="1.0" encoding="utf-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema" targetNamespace="http://example.com/library" elementFormDefault="qualified">
  <xsd:complexType name="Book">
    <xsd:sequence>
      <xsd:element name="title" type="xsd:string"/>
      <xsd:element name="author" type="xsd:string"/>
      <xsd:element name="year" type="xsd:int"/>
    </xsd:sequence>
    <xsd:attribute name="isbn" type="xsd:string"/>
  </xsd:complexType>
</xsd:schema>`;

describe("CLI tool (xsd2ts)", () => {
  let tmpDir: string;
  let xsdFile: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "xmlbind-cli-test-"));
    xsdFile = path.join(tmpDir, "test.xsd");
    writeFileSync(xsdFile, SAMPLE_XSD, "utf8");
  });

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  test("CLI generates TypeScript file from XSD", () => {
    const outDir = path.join(tmpDir, "output");

    // Run the CLI tool using ts-node with --no-delete to skip interactive prompt
    const command = `npx ts-node src/xsd/cli.ts -i "${xsdFile}" -o "${outDir}" --no-delete`;

    try {
      execSync(command, {
        cwd: path.resolve(__dirname, ".."),
        encoding: "utf8",
        stdio: "pipe",
      });
    } catch (error: any) {
      // If the command fails, log the error for debugging
      console.error("CLI execution failed:", error.message);
      if (error.stdout) console.error("stdout:", error.stdout);
      if (error.stderr) console.error("stderr:", error.stderr);
      throw error;
    }

    // Verify the output file exists
    const outputFile = path.join(outDir, "Book.ts");
    expect(existsSync(outputFile)).toBe(true);

    // Verify the content of the generated file
    const generatedContent = readFileSync(outputFile, "utf8");
    expect(generatedContent).toContain("export class Book");
    expect(generatedContent).toMatch(/title[!?]: string/);
    expect(generatedContent).toMatch(/author[!?]: string/);
    expect(generatedContent).toMatch(/year[!?]: number/);
    expect(generatedContent).toMatch(/isbn[!?]: string/);

    // Verify decorators are present
    expect(generatedContent).toContain("@XmlRoot");
    expect(generatedContent).toContain("@XmlElement");
    expect(generatedContent).toContain("@XmlAttribute");
  });

  test("CLI requires input and output options", () => {
    // Test that the CLI fails without required options
    const command = `npx ts-node src/xsd/cli.ts`;

    expect(() => {
      execSync(command, {
        cwd: path.resolve(__dirname, ".."),
        encoding: "utf8",
        stdio: "pipe",
      });
    }).toThrow();
  });

  test("CLI fails gracefully with non-existent input file", () => {
    const outDir = path.join(tmpDir, "output");
    const nonExistentFile = path.join(tmpDir, "does-not-exist.xsd");
    const command = `npx ts-node src/xsd/cli.ts -i "${nonExistentFile}" -o "${outDir}" --no-delete`;

    expect(() => {
      execSync(command, {
        cwd: path.resolve(__dirname, ".."),
        encoding: "utf8",
        stdio: "pipe",
      });
    }).toThrow();
  });

  test("CLI with --no-delete skips file deletion", () => {
    const outDir = path.join(tmpDir, "output");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, "existing.ts"), "// existing file", "utf8");

    const command = `npx ts-node src/xsd/cli.ts -i "${xsdFile}" -o "${outDir}" --no-delete`;

    execSync(command, {
      cwd: path.resolve(__dirname, ".."),
      encoding: "utf8",
      stdio: "pipe",
    });

    // Verify both files exist
    expect(existsSync(path.join(outDir, "existing.ts"))).toBe(true);
    expect(existsSync(path.join(outDir, "Book.ts"))).toBe(true);
  });

  test("CLI with --force deletes existing files without prompting", () => {
    const outDir = path.join(tmpDir, "output");
    mkdirSync(outDir, { recursive: true });

    // Create existing TypeScript files
    writeFileSync(
      path.join(outDir, "existing1.ts"),
      "// existing file 1",
      "utf8"
    );
    writeFileSync(
      path.join(outDir, "existing2.ts"),
      "// existing file 2",
      "utf8"
    );

    const command = `npx ts-node src/xsd/cli.ts -i "${xsdFile}" -o "${outDir}" --force`;

    const output = execSync(command, {
      cwd: path.resolve(__dirname, ".."),
      encoding: "utf8",
      stdio: "pipe",
    });

    // Verify output mentions file deletion
    expect(output).toContain("Deleted");

    // Verify old files are gone
    expect(existsSync(path.join(outDir, "existing1.ts"))).toBe(false);
    expect(existsSync(path.join(outDir, "existing2.ts"))).toBe(false);

    // Verify new files were generated
    expect(existsSync(path.join(outDir, "Book.ts"))).toBe(true);
  });

  test("CLI with --force and --no-delete uses --no-delete (no deletion)", () => {
    const outDir = path.join(tmpDir, "output");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, "existing.ts"), "// existing file", "utf8");

    const command = `npx ts-node src/xsd/cli.ts -i "${xsdFile}" -o "${outDir}" --force --no-delete`;

    execSync(command, {
      cwd: path.resolve(__dirname, ".."),
      encoding: "utf8",
      stdio: "pipe",
    });

    // Verify existing file still exists (--no-delete takes precedence)
    expect(existsSync(path.join(outDir, "existing.ts"))).toBe(true);
    expect(existsSync(path.join(outDir, "Book.ts"))).toBe(true);
  });
});
