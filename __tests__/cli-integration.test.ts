/**
 * Integration tests for the CLI tool (xsd2ts).
 *
 * This test installs the packed package into a temporary consumer project and
 * invokes its xsd2ts binary. Unit tests cover CLI behavior separately.
 */
import { execFileSync, spawnSync } from "child_process";
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

function installPackedPackage(tmpDir: string): string {
  const packageRoot = process.cwd();
  const consumerDir = path.join(tmpDir, "consumer");
  const [packResult] = JSON.parse(
    execFileSync("npm", ["pack", "--json", "--pack-destination", tmpDir], {
      cwd: packageRoot,
      encoding: "utf8",
    })
  );
  const packageTarball = path.join(tmpDir, packResult.filename);

  mkdirSync(consumerDir);
  writeFileSync(
    path.join(consumerDir, "package.json"),
    JSON.stringify({ private: true }, null, 2),
    "utf8"
  );
  execFileSync("npm", ["install", "--ignore-scripts", packageTarball], {
    cwd: consumerDir,
    encoding: "utf8",
  });

  return consumerDir;
}

describe("packaged xsd2ts CLI", () => {
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

  test("generates classes that type-check in an ESM consumer", () => {
    const consumerDir = installPackedPackage(tmpDir);
    const outDir = path.join(consumerDir, "output");

    execFileSync(
      path.join(consumerDir, "node_modules", ".bin", "xsd2ts"),
      ["--input", xsdFile, "--out", outDir],
      { cwd: consumerDir, encoding: "utf8" }
    );

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

    writeFileSync(
      path.join(consumerDir, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            noEmit: true,
          },
          include: ["output"],
        },
        null,
        2
      ),
      "utf8"
    );
    execFileSync(
      path.join(process.cwd(), "node_modules", ".bin", "tsc"),
      ["--project", "tsconfig.json"],
      { cwd: consumerDir, encoding: "utf8" }
    );
  }, 30000);

  test("generates classes that compile and round-trip XML in a CommonJS consumer", () => {
    const consumerDir = installPackedPackage(tmpDir);
    const outDir = path.join(consumerDir, "generated");

    execFileSync(
      path.join(consumerDir, "node_modules", ".bin", "xsd2ts"),
      ["--input", xsdFile, "--out", outDir],
      { cwd: consumerDir, encoding: "utf8" }
    );
    writeFileSync(
      path.join(consumerDir, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "CommonJS",
            outDir: "compiled",
            rootDir: "generated",
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
            esModuleInterop: true,
            skipLibCheck: true,
            types: [],
          },
          include: ["generated"],
        },
        null,
        2
      ),
      "utf8"
    );
    execFileSync(
      path.join(process.cwd(), "node_modules", ".bin", "tsc"),
      ["--project", "tsconfig.json"],
      { cwd: consumerDir, encoding: "utf8" }
    );
    const output = execFileSync(
      "node",
      [
        "-e",
        "const { Book } = require('./compiled/Book.js'); " +
          "const { marshal, unmarshal } = require('@neumaennl/xmlbind-ts'); " +
          "const book = new Book(); book.title = 'The Hobbit'; " +
          "const xml = marshal(book); " +
          "if (unmarshal(Book, xml).title !== 'The Hobbit') process.exit(1);",
      ],
      { cwd: consumerDir, encoding: "utf8" }
    );

    expect(output).toBe("");
  }, 30000);

  test("reports missing required options", () => {
    const consumerDir = installPackedPackage(tmpDir);
    const cliPath = path.join(consumerDir, "node_modules", ".bin", "xsd2ts");

    const result = spawnSync(cliPath, [], { cwd: consumerDir, encoding: "utf8" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("required option '-i, --input <file>' not specified");
  }, 30000);
});
