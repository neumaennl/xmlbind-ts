/**
 * Custom assertion utilities for tests.
 */

/**
 * Verifies that the expected strings appear consecutively in the given text.
 * This ensures the strings appear in the specified order and are not just scattered
 * throughout the text.
 *
 * @param text - The text to search in
 * @param expectedStrings - Array of strings that should appear consecutively in order
 * @throws Error if any expected string is not found or if they don't appear in order
 *
 * @example
 * ```typescript
 * const xml = '<root><a>1</a><b>2</b><c>3</c></root>';
 * expectConsecutiveStrings(xml, ['<a>1</a>', '<b>2</b>', '<c>3</c>']); // passes
 * expectConsecutiveStrings(xml, ['<c>3</c>', '<a>1</a>']); // fails - wrong order
 * ```
 */
export function expectConsecutiveStrings(
  text: string,
  expectedStrings: string[]
): void {
  let searchStartIndex = 0;

  for (let i = 0; i < expectedStrings.length; i++) {
    const expectedStr = expectedStrings[i];
    const index = text.indexOf(expectedStr, searchStartIndex);

    if (index === -1) {
      const previous = i > 0 ? expectedStrings[i - 1] : "(start of text)";
      throw new Error(
        `Expected string "${expectedStr}" not found after "${previous}". ` +
          `Searched from index ${searchStartIndex} in text of length ${text.length}.`
      );
    }

    // Update search position for next string to ensure consecutive order
    searchStartIndex = index + expectedStr.length;
  }
}
