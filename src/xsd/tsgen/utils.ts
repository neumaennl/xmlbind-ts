import type { Element as XmldomElement } from "@xmldom/xmldom";

/**
 * Extracts the local name from a qualified XML name (QName).
 *
 * @param qname - A qualified name like "xs:string" or "string"
 * @returns The local part after the colon, or the entire name if no colon exists
 */
export function localName(qname?: string | null): string | undefined {
  if (!qname) return undefined;
  return qname.includes(":") ? qname.split(":").pop()! : qname;
}

/**
 * Constructs a prefixed XSD element name.
 *
 * @param localName - The local name of the element
 * @param prefix - The namespace prefix (empty string for no prefix)
 * @returns The prefixed name like "xs:element", or just the local name if no prefix
 */
export function makeXsdName(localName: string, prefix: string): string {
  return prefix ? `${prefix}:${localName}` : localName;
}

/**
 * Finds the first child element with the specified local name.
 * Tries both prefixed and unprefixed versions of the element name.
 *
 * @param el - The parent element to search within
 * @param localName - The local name to search for
 * @param xsdPrefix - The XSD namespace prefix
 * @returns The first matching child element, or undefined if not found
 */
export function getChildByLocalName(
  el: XmldomElement,
  localName: string,
  xsdPrefix: string
): XmldomElement | undefined {
  const prefixedName = makeXsdName(localName, xsdPrefix);
  const byPrefixed = el.getElementsByTagName(prefixedName)[0];
  if (byPrefixed) return byPrefixed as XmldomElement;
  const byLocal = el.getElementsByTagName(localName)[0];
  if (byLocal) return byLocal as XmldomElement;
  return undefined;
}

/**
 * Finds all child elements with the specified local name.
 * Searches for both prefixed and unprefixed versions, returning all matches without duplicates.
 *
 * @param el - The parent element to search within
 * @param localName - The local name to search for
 * @param xsdPrefix - The XSD namespace prefix
 * @returns An array of all matching child elements
 */
export function getChildrenByLocalName(
  el: XmldomElement,
  localName: string,
  xsdPrefix: string
): XmldomElement[] {
  const prefixedName = makeXsdName(localName, xsdPrefix);
  const results: XmldomElement[] = [];
  const prefixed = Array.from(el.getElementsByTagName(prefixedName));
  results.push(...(prefixed as XmldomElement[]));
  const unprefixed = Array.from(el.getElementsByTagName(localName));
  for (const elem of unprefixed) {
    if (!results.includes(elem as XmldomElement)) {
      results.push(elem as XmldomElement);
    }
  }
  return results;
}

/**
 * Extracts documentation text from an XSD element's annotation/documentation child.
 * Looks for xs:annotation/xs:documentation elements and returns the text content.
 *
 * @param el - The XSD element to extract documentation from
 * @param xsdPrefix - The XSD namespace prefix
 * @returns The documentation text, or undefined if no documentation is found or if the text is empty
 */
export function getDocumentation(
  el: XmldomElement,
  xsdPrefix: string
): string | undefined {
  const annotation = getChildByLocalName(el, "annotation", xsdPrefix);
  if (!annotation) return undefined;

  const documentation = getChildByLocalName(annotation, "documentation", xsdPrefix);
  if (!documentation) return undefined;

  // Get the text content from the documentation element
  const textContent = documentation.textContent;
  if (!textContent) return undefined;

  // Trim whitespace and check if there's any content
  const trimmed = textContent.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Formats documentation text as a TSDoc comment block.
 * Handles multi-line documentation by properly indenting each line.
 * Handles different line ending types (\\r\\n, \\r, \\n) consistently.
 *
 * @param docText - The documentation text to format
 * @param indent - The indentation string (e.g., "  " for 2 spaces)
 * @returns An array of comment lines ready to be added to the output
 */
export function formatTsDoc(docText: string, indent: string = ""): string[] {
  // Normalize line endings to \n and split
  const normalizedText = docText.replace(/\r\n?/g, "\n");
  const lines = normalizedText.split("\n").map((line) => line.trim());
  
  // Find the first and last non-empty lines
  const firstNonEmpty = lines.findIndex((line) => line !== "");
  
  // If no non-empty lines found, return empty array
  if (firstNonEmpty === -1) return [];
  
  // Find last non-empty line by iterating backwards
  let lastNonEmpty = lines.length - 1;
  while (lastNonEmpty >= 0 && lines[lastNonEmpty] === "") {
    lastNonEmpty--;
  }
  
  // Extract the range with non-empty boundaries
  const trimmedLines = lines.slice(firstNonEmpty, lastNonEmpty + 1);

  const result: string[] = [];
  result.push(`${indent}/**`);
  for (const line of trimmedLines) {
    // Handle empty lines explicitly to avoid trailing whitespace
    if (line === "") {
      result.push(`${indent} *`);
    } else {
      result.push(`${indent} * ${line}`);
    }
  }
  result.push(`${indent} */`);
  
  return result;
}
