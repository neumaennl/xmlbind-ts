import { execSync } from "child_process";
import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdtempSync,
  rmSync,
} from "fs";
import os from "os";
import path from "path";
import { expectConsecutiveStrings } from "./test-utils";

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

    // Run the CLI tool using ts-node
    const command = `npx ts-node src/xsd/cli.ts xsd2ts -i "${xsdFile}" -o "${outDir}"`;

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
    expect(generatedContent).toMatch(/title.*: String|title\?: String/);
    expect(generatedContent).toMatch(/author.*: String|author\?: String/);
    expect(generatedContent).toMatch(/year.*: Number|year\?: Number/);
    expect(generatedContent).toMatch(/isbn.*: String|isbn\?: String/);

    // Verify decorators are present
    expect(generatedContent).toContain("@XmlRoot");
    expect(generatedContent).toContain("@XmlElement");
    expect(generatedContent).toContain("@XmlAttribute");
  });

  test("CLI requires input and output options", () => {
    // Test that the CLI fails without required options
    const command = `npx ts-node src/xsd/cli.ts xsd2ts`;

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
    const command = `npx ts-node src/xsd/cli.ts xsd2ts -i "${nonExistentFile}" -o "${outDir}"`;

    expect(() => {
      execSync(command, {
        cwd: path.resolve(__dirname, ".."),
        encoding: "utf8",
        stdio: "pipe",
      });
    }).toThrow();
  });
});
