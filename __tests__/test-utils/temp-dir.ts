import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

/**
 * Creates a temporary directory, runs the callback, and cleans up afterwards.
 * 
 * @param callback - Function to run with the temporary directory path
 * @param prefix - Optional prefix for the temp directory name (default: "xmlbind-test-")
 */
export function withTmpDir(
  callback: (dir: string) => void,
  prefix: string = "xmlbind-test-"
): void {
  const tmpDir = mkdtempSync(join(tmpdir(), prefix));
  try {
    callback(tmpDir);
  } finally {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
