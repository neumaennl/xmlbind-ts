import { program } from "commander";
import { readFileSync } from "fs";
import { generateFromXsd } from "./TsGenerator";

program
  .command("xsd2ts")
  .requiredOption("-i, --input <file>")
  .requiredOption("-o, --out <dir>")
  .action((opts) => {
    const txt = readFileSync(opts.input, "utf8");
    generateFromXsd(txt, opts.out);
  });

program.parse(process.argv);
