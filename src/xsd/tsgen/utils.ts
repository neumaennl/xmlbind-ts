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
