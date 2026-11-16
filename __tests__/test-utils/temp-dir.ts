// fallow-ignore-file unused-file -- the tests of version 3 will use it; remove this comment when one does

import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

/**
 * Creates a temporary directory, runs the callback, and cleans up afterwards.
 * 
 * @param callback - Function to run with the temporary directory path
 * @param prefix - Optional prefix for the temp directory name (default: "xmlbind-test-")
 */
export async function withTmpDir(
  callback: (dir: string) => void | Promise<void>,
  prefix = "xmlbind-test-"
): Promise<void> {
  const tmpDir = mkdtempSync(join(tmpdir(), prefix));
  try {
    await callback(tmpDir);
  } finally {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
