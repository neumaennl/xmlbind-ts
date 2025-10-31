import type { Element as XmldomElement } from "@xmldom/xmldom";

/**
 * Returns direct child elements of a given element that match specified local names.
 *
 * Filters child nodes to only include element nodes (nodeType === 1) that match
 * one of the provided local names, supporting both prefixed and unprefixed forms.
 *
 * @param el - The parent element
 * @param names - Array of local names to match
 * @param xsdPrefix - The XSD namespace prefix to consider
 * @returns An array of matching child elements
 */
export function directChildren(
  el: XmldomElement,
  names: string[],
  xsdPrefix: string
): XmldomElement[] {
  const out: XmldomElement[] = [];
  const set = new Set(names);

  // Add prefixed versions to the set
  const prefixedNames = new Set<string>();
  for (const name of names) {
    prefixedNames.add(name);
    if (xsdPrefix) {
      prefixedNames.add(`${xsdPrefix}:${name}`);
    }
  }

  for (let i = 0; i < (el.childNodes?.length ?? 0); i++) {
    const n = el.childNodes[i] as any;
    if (!n || n.nodeType !== 1) continue; // ELEMENT_NODE
    const nn = (n.nodeName as string) || "";
    const ln = nn.includes(":") ? nn.split(":").pop()! : nn;
    if (set.has(nn) || set.has(ln) || prefixedNames.has(nn))
      out.push(n as XmldomElement);
  }
  return out;
}
