import { existsSync, readdirSync, rmSync } from "fs";
import { join } from "path";
import * as readline from "readline";

/**
 * Cleans up existing TypeScript files from the output directory.
 * Optionally prompts the user for confirmation, or silently deletes if force is true.
 *
 * @param outDir - The output directory to clean
 * @param force - If true, delete files without prompting. If false, prompt the user.
 * @returns Promise&lt;boolean> - true if user chose to delete files (or force was true), false if user cancelled
 */
export async function cleanupGeneratedFiles(
  outDir: string,
  force: boolean = false
): Promise<boolean> {
  if (!existsSync(outDir)) {
    return true; // Directory doesn't exist, nothing to clean
  }

  const files = readdirSync(outDir);
  const tsFiles = files.filter((f) => f.endsWith(".ts"));

  if (tsFiles.length === 0) {
    return true; // No TypeScript files to delete
  }

  if (force) {
    // Delete without prompting
    deleteFiles(tsFiles, outDir);
    return true;
  }

  // Prompt the user for confirmation
  console.warn(
    `\n⚠️  WARNING: The output directory contains ${tsFiles.length} TypeScript file(s):`
  );
  tsFiles.slice(0, 5).forEach((f) => console.warn(`   - ${f}`));
  if (tsFiles.length > 5) {
    console.warn(`   ... and ${tsFiles.length - 5} more`);
  }

  console.warn(
    "\nThese files will be deleted before generating new files from the XSD schema."
  );

  const confirmed = await promptForConfirmation(
    "\nDo you want to continue? (yes/no): "
  );

  if (confirmed) {
    deleteFiles(tsFiles, outDir);
  }

  return confirmed;
}

/**
 * Deletes the specified TypeScript files from the output directory.
 * Reports errors for files that could not be deleted.
 *
 * @param tsFiles - Array of TypeScript filenames to delete
 * @param outDir - The output directory containing the files
 */
function deleteFiles(tsFiles: string[], outDir: string): void {
  let deletedCount = 0;
  const errors: Array<{ file: string; error: string }> = [];

  for (const f of tsFiles) {
    const filePath = join(outDir, f);
    try {
      rmSync(filePath);
      deletedCount++;
    } catch (error: any) {
      errors.push({ file: f, error: error.message || String(error) });
    }
  }

  if (deletedCount > 0) {
    console.log(`✓ Deleted ${deletedCount} file(s).`);
  }

  if (errors.length > 0) {
    console.error(
      `\n⚠️  Failed to delete ${errors.length} file(s) due to errors:`
    );
    errors.forEach(({ file, error }) => {
      console.error(`   - ${file}: ${error}`);
    });
  }
}

/**
 * Prompts the user for a yes/no confirmation.
 *
 * @param question - The question to display
 * @returns Promise&lt;boolean> - true if user answered yes, false otherwise
 */
function promptForConfirmation(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer.toLowerCase() === "yes" || answer.toLowerCase() === "y");
    });
  });
}
