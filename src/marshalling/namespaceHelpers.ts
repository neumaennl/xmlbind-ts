/**
 * Namespace and wildcard attribute/element helpers for unmarshalling
 */

import { isNamespaceDeclaration } from "../util/namespaceUtils";
import { ParsedXmlNode } from "./types";

export type NsMap = { [prefix: string]: string };

/**
 * Collects namespace declarations from an XML node, inheriting from parent context.
 * Scans for xmlns and xmlns:prefix attributes to build a prefix-to-URI mapping.
 *
 * @param node - The XML node to scan for namespace declarations
 * @param parent - The parent namespace map to inherit from (optional)
 * @returns A map of namespace prefixes to URIs
 */
export function collectNs(node: ParsedXmlNode, parent: NsMap | undefined): NsMap {
  const map: NsMap = parent ? { ...parent } : {};
  for (const k of Object.keys(node)) {
    if (!k.startsWith("@_")) continue;
    const name = k.substring(2);
    if (name === "xmlns") {
      map[""] = String((node as any)[k]);
    } else if (name.startsWith("xmlns:")) {
      const pfx = name.substring("xmlns:".length);
      map[pfx] = String((node as any)[k]);
    }
  }
  return map;
}

/**
 * Finds an element key in the parsed XML node that matches the given local name and namespace.
 * Handles both prefixed and unprefixed element names.
 *
 * @param node - The parsed XML node
 * @param local - The local name of the element
 * @param ns - The expected namespace URI (optional)
 * @param nsMap - The namespace prefix mapping
 * @returns The matching key from the node, or undefined if not found
 */
export function matchElementKey(
  node: ParsedXmlNode,
  local: string,
  ns: string | undefined,
  nsMap: NsMap
): string | undefined {
  // try direct match first
  if (node[local] !== undefined && ns === undefined) return local;
  // otherwise scan keys and match by local name and namespace
  for (const key of Object.keys(node)) {
    if (key.startsWith("@_") || key === "#text") continue;
    const idx = key.indexOf(":");
    const kLocal = idx >= 0 ? key.substring(idx + 1) : key;
    if (kLocal !== local) continue;
    const prefix = idx >= 0 ? key.substring(0, idx) : "";
    const uri = prefix ? nsMap[prefix] : nsMap[""];
    if (ns === undefined || uri === ns) return key;
  }
  return undefined;
}

/**
 * Finds an attribute key in the parsed XML node that matches the given local name and namespace.
 * Note: Default namespace doesn't apply to attributes; they must be explicitly prefixed.
 *
 * @param node - The parsed XML node
 * @param local - The local name of the attribute
 * @param ns - The expected namespace URI (optional)
 * @param nsMap - The namespace prefix mapping
 * @returns The matching attribute key from the node (with @_ prefix), or undefined if not found
 */
export function matchAttributeKey(
  node: ParsedXmlNode,
  local: string,
  ns: string | undefined,
  nsMap: NsMap
): string | undefined {
  // Attributes with namespace must be prefixed; default namespace doesn't apply to attributes
  if (ns === undefined) {
    const k = "@_" + local;
    if ((node as any)[k] !== undefined) return k;
  } else {
    for (const key of Object.keys(node)) {
      if (!key.startsWith("@_")) continue;
      const name = key.substring(2);
      const idx = name.indexOf(":");
      if (idx < 0) continue; // unprefixed attribute: no namespace
      const pfx = name.substring(0, idx);
      const kLocal = name.substring(idx + 1);
      if (kLocal !== local) continue;
      const uri = nsMap[pfx];
      if (uri === ns) return key;
    }
  }
  return undefined;
}

/**
 * Collects wildcard attributes that were not already bound to explicit fields.
 * Excludes xmlns namespace declarations as they are handled separately by the namespace context.
 *
 * @param node - The parsed XML node
 * @param fields - All fields from the class metadata
 * @param nsMap - The namespace prefix mapping
 * @returns A record of unbound attribute names to values
 */
export function collectWildcardAttributes(
  node: ParsedXmlNode,
  fields: any[],
  nsMap: NsMap
): Record<string, string> {
  const boundAttrKeys = new Set<string>();
  for (const f of fields.filter((f) => f.kind === "attribute")) {
    const k = matchAttributeKey(
      node,
      f.name || f.key,
      f.namespace ?? undefined,
      nsMap
    );
    if (k) boundAttrKeys.add(k);
  }
  const collected: Record<string, string> = {};
  for (const key of Object.keys(node)) {
    if (!key.startsWith("@_")) continue;
    if (boundAttrKeys.has(key)) continue;
    const attrName = key.substring(2);
    // Skip xmlns declarations as they are handled by the namespace context
    if (isNamespaceDeclaration(attrName)) continue;
    const v = (node as any)[key];
    if (v !== undefined) collected[attrName] = String(v);
  }
  return collected;
}

/**
 * Collects wildcard elements that were not already bound to explicit fields.
 *
 * @param node - The parsed XML node
 * @param fields - All fields from the class metadata
 * @param nsMap - The namespace prefix mapping
 * @returns An array of unbound element values, each as {elementName: value}
 */
export function collectWildcardElements(
  node: ParsedXmlNode,
  fields: any[],
  nsMap: NsMap
): any[] {
  const boundElemKeys = new Set<string>();
  for (const f of fields.filter((f) => f.kind === "element")) {
    const k = matchElementKey(
      node,
      f.name || f.key,
      f.namespace ?? undefined,
      nsMap
    );
    if (k) boundElemKeys.add(k);
  }
  const collected: any[] = [];
  for (const key of Object.keys(node)) {
    if (key.startsWith("@_") || key === "#text") continue;
    if (boundElemKeys.has(key)) continue;
    
    const value = (node as any)[key];
    // If the value is an array, it means multiple elements with the same name
    // Each should be added as a separate object {elementName: value}
    if (Array.isArray(value)) {
      for (const item of value) {
        collected.push({ [key]: item });
      }
    } else {
      // Single element
      collected.push({ [key]: value });
    }
  }
  return collected;
}
