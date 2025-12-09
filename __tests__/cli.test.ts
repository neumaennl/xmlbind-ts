/**
 * Unit tests for the CLI module (cli.ts).
 *
 * These tests directly test the CLI action handler by mocking dependencies,
 * providing accurate code coverage for the CLI logic.
 */
import { writeFileSync, mkdtempSync, mkdirSync, rmSync } from "fs";
import os from "os";
import path from "path";

// Mock the dependencies before importing
const mockGenerateFromXsd = jest.fn();
const mockCleanupGeneratedFiles = jest.fn();

jest.mock("../src/xsd/TsGenerator", () => ({
  generateFromXsd: mockGenerateFromXsd,
}));

jest.mock("../src/xsd/fileCleanup", () => ({
  cleanupGeneratedFiles: mockCleanupGeneratedFiles,
}));

// Import after mocking
import { cliAction, type CliOptions } from "../src/xsd/cli";

const SAMPLE_XSD = `<?xml version="1.0" encoding="utf-8"?>
<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <xsd:element name="root" type="xsd:string"/>
</xsd:schema>`;

describe("CLI module (unit tests)", () => {
  let tmpDir: string;
  let xsdFile: string;
  let outDir: string;
  let originalExit: typeof process.exit;
  let exitCode: number | undefined;

  beforeEach(() => {
    // Create temp directory and files
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "xmlbind-cli-unit-"));
    xsdFile = path.join(tmpDir, "test.xsd");
    outDir = path.join(tmpDir, "output");
    mkdirSync(outDir);
    writeFileSync(xsdFile, SAMPLE_XSD, "utf8");

    // Reset mocks
    jest.clearAllMocks();
    mockGenerateFromXsd.mockImplementation(() => {});
    mockCleanupGeneratedFiles.mockResolvedValue(true);

    // Save original process.exit
    originalExit = process.exit;
    exitCode = undefined;

    // Mock process.exit to capture exit code
    process.exit = jest.fn((code?: number) => {
      exitCode = code;
      throw new Error(`process.exit(${code})`);
    }) as any;
  });

  afterEach(() => {
    // Restore process.exit
    process.exit = originalExit;

    // Clean up temp directory
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  test("calls generateFromXsd with correct arguments when --no-delete is used", async () => {
    const opts: CliOptions = {
      input: xsdFile,
      out: outDir,
      delete: false, // --no-delete sets delete to false
    };

    await cliAction(opts);

    // Verify cleanupGeneratedFiles was NOT called
    expect(mockCleanupGeneratedFiles).not.toHaveBeenCalled();

    // Verify generateFromXsd was called with correct arguments
    expect(mockGenerateFromXsd).toHaveBeenCalledWith(SAMPLE_XSD, outDir);
  });

  test("calls cleanupGeneratedFiles with force=true when --force is used", async () => {
    const opts: CliOptions = {
      input: xsdFile,
      out: outDir,
      force: true,
      delete: true,
    };

    await cliAction(opts);

    // Verify cleanupGeneratedFiles was called with force=true
    expect(mockCleanupGeneratedFiles).toHaveBeenCalledWith(outDir, true);

    // Verify generateFromXsd was called
    expect(mockGenerateFromXsd).toHaveBeenCalledWith(SAMPLE_XSD, outDir);
  });

  test("calls cleanupGeneratedFiles with force=false when neither flag is used", async () => {
    const opts: CliOptions = {
      input: xsdFile,
      out: outDir,
      delete: true, // Default when --no-delete is not specified
    };

    await cliAction(opts);

    // Verify cleanupGeneratedFiles was called with force=false
    expect(mockCleanupGeneratedFiles).toHaveBeenCalledWith(outDir, false);

    // Verify generateFromXsd was called
    expect(mockGenerateFromXsd).toHaveBeenCalledWith(SAMPLE_XSD, outDir);
  });

  test("exits when user cancels cleanup (cleanupGeneratedFiles returns false)", async () => {
    mockCleanupGeneratedFiles.mockResolvedValue(false);

    const opts: CliOptions = {
      input: xsdFile,
      out: outDir,
      delete: true,
    };

    await expect(cliAction(opts)).rejects.toThrow("process.exit(0)");

    // Verify cleanupGeneratedFiles was called
    expect(mockCleanupGeneratedFiles).toHaveBeenCalledWith(outDir, false);

    // Verify generateFromXsd was NOT called (operation cancelled)
    expect(mockGenerateFromXsd).not.toHaveBeenCalled();

    // Verify process.exit was called with 0
    expect(exitCode).toBe(0);
  });

  test("reads input file correctly", async () => {
    const customXsd = `<?xml version="1.0"?><xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"><xsd:element name="custom" type="xsd:int"/></xsd:schema>`;
    const customXsdFile = path.join(tmpDir, "custom.xsd");
    writeFileSync(customXsdFile, customXsd, "utf8");

    const opts: CliOptions = {
      input: customXsdFile,
      out: outDir,
      delete: false,
    };

    await cliAction(opts);

    // Verify generateFromXsd was called with the custom XSD content
    expect(mockGenerateFromXsd).toHaveBeenCalledWith(customXsd, outDir);
  });

  test("handles both --force and --no-delete (--no-delete takes precedence)", async () => {
    const opts: CliOptions = {
      input: xsdFile,
      out: outDir,
      force: true,
      delete: false, // --no-delete takes precedence
    };

    await cliAction(opts);

    // Verify cleanupGeneratedFiles was NOT called (--no-delete takes precedence)
    expect(mockCleanupGeneratedFiles).not.toHaveBeenCalled();

    // Verify generateFromXsd was called
    expect(mockGenerateFromXsd).toHaveBeenCalledWith(SAMPLE_XSD, outDir);
  });
});
