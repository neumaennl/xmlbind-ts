#!/usr/bin/env node

import { program } from "commander";
import { readFileSync } from "fs";
import { generateFromXsd } from "./TsGenerator.js";
import { cleanupGeneratedFiles } from "./fileCleanup.js";

/**
 * Options interface for the CLI action handler.
 */
export interface CliOptions {
  input: string;
  out: string;
  force?: boolean;
  delete: boolean; // Note: --no-delete sets this to false
  importExtensions?: boolean; // Note: --no-import-extensions sets this to false
}

/**
 * Action handler for the xsd2ts CLI command.
 * Exported for testing purposes.
 *
 * @param opts - Command options
 */
export async function cliAction(opts: CliOptions): Promise<void> {
  const txt = readFileSync(opts.input, "utf8");

  // Handle file cleanup if not --no-delete
  if (opts.delete) {
    // If --force is specified, delete without prompting
    if (opts.force) {
      await cleanupGeneratedFiles(opts.out, true);
    } else {
      // Otherwise, prompt the user
      const shouldDelete = await cleanupGeneratedFiles(opts.out, false);
      if (!shouldDelete) {
        console.log("Operation cancelled. No files were generated.");
        process.exit(0);
      }
    }
  }

  generateFromXsd(txt, opts.out, opts.importExtensions !== false);
}

/**
 * CLI tool: xsd2ts
 *
 * Converts an XSD schema file to TypeScript class definitions.
 * Generates TypeScript files with decorators for XML marshalling/unmarshalling.
 *
 * Usage: xsd2ts -i <<input.xsd> -o <output-directory> [--force] [--no-delete] [--no-import-extensions]
 */
program
  .description("Generate TypeScript classes from XSD schema")
  .requiredOption("-i, --input <file>", "Input XSD schema file")
  .requiredOption(
    "-o, --out <dir>",
    "Output directory for generated TypeScript files"
  )
  .option("--force", "Run without prompting for confirmation (non-interactive)")
  .option(
    "--no-delete",
    "Skip deletion of existing *.ts files in output directory"
  )
  .option(
    "--no-import-extensions",
    "Omit .js extensions in relative imports and exports (for older module styles)"
  )
  .action(cliAction);

// Only parse arguments if this file is being run directly (not imported)
const isDirectExecution =
  process.argv[1] !== undefined &&
  /(?:^|[\\/])(?:cli(?:\.[mc]?js|\.ts)?|xsd2ts)$/.test(process.argv[1]);

if (isDirectExecution) {
  program.parse(process.argv);
}
