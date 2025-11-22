/**
 * Custom assertion utilities for tests.
 */

/**
 * Verifies that the expected strings appear consecutively in the given text.
 * For multi-line text (e.g., generated code), ensures strings appear on consecutive lines.
 * For single-line text (e.g., XML output), ensures strings appear in order without other content in between.
 *
 * @param text - The text to search in
 * @param expectedStrings - Array of strings that should appear consecutively
 * @throws Error if any expected string is not found or if they don't appear consecutively
 *
 * @example
 * ```typescript
 * // Multi-line text - verifies consecutive lines
 * const code = 'export enum Colors {\n  red = "red",\n  blue = "blue",\n}';
 * expectConsecutiveStrings(code, ['export enum Colors', 'red = "red"', 'blue = "blue"']); // passes
 * 
 * // Single-line text - verifies consecutive appearance
 * const xml = '<Task id="2"><title>Fix bug</title><status>approved</status></Task>';
 * expectConsecutiveStrings(xml, ['id="2"', '<title>Fix bug</title>', '<status>approved</status>']); // passes
 * ```
 */
export function expectConsecutiveStrings(
  text: string,
  expectedStrings: string[]
): void {
  const lines = text.split('\n');
  
  // If text is single-line or has very few lines, use position-based checking
  if (lines.length <= 2) {
    let searchStartIndex = 0;
    
    for (let i = 0; i < expectedStrings.length; i++) {
      const expectedStr = expectedStrings[i];
      const index = text.indexOf(expectedStr, searchStartIndex);
      
      if (index === -1) {
        const previous = i > 0 ? expectedStrings[i - 1] : "(start of text)";
        throw new Error(
          `Expected string "${expectedStr}" not found after "${previous}". ` +
          `Searched from position ${searchStartIndex} in text of length ${text.length}.`
        );
      }
      
      // Update search position for next string to ensure consecutive order
      searchStartIndex = index + expectedStr.length;
    }
    return;
  }
  
  // For multi-line text, verify strings appear on consecutive lines
  let currentLineIndex = 0;

  for (let i = 0; i < expectedStrings.length; i++) {
    const expectedStr = expectedStrings[i];
    let found = false;

    // Search for the expected string starting from currentLineIndex
    for (let lineIdx = currentLineIndex; lineIdx < lines.length; lineIdx++) {
      if (lines[lineIdx].includes(expectedStr)) {
        found = true;
        currentLineIndex = lineIdx + 1; // Move to next line for next search
        break;
      }
    }

    if (!found) {
      const previous = i > 0 ? expectedStrings[i - 1] : "(start of text)";
      const searchContext = lines.slice(Math.max(0, currentLineIndex - 2), currentLineIndex + 3).join('\n');
      throw new Error(
        `Expected string "${expectedStr}" not found on consecutive lines after "${previous}".\n` +
        `Searched from line ${currentLineIndex + 1}.\n` +
        `Context:\n${searchContext}`
      );
    }
  }
}
