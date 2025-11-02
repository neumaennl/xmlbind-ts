import { program } from "commander";
import { readFileSync } from "fs";
import { generateFromXsd } from "./TsGenerator";

/**
 * CLI command: xsd2ts
 *
 * Converts an XSD schema file to TypeScript class definitions.
 * Generates TypeScript files with decorators for XML marshalling/unmarshalling.
 *
 * Usage: xsd2ts -i <input.xsd> -o <output-directory>
 */
program
  .command("xsd2ts")
  .description("Generate TypeScript classes from XSD schema")
  .requiredOption("-i, --input <file>", "Input XSD schema file")
  .requiredOption("-o, --out <dir>", "Output directory for generated TypeScript files")
  .action((opts) => {
    const txt = readFileSync(opts.input, "utf8");
    generateFromXsd(txt, opts.out);
  });

program.parse(process.argv);
