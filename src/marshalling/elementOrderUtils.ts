/**
 * Utilities for preserving XML element order during unmarshal/marshal roundtrip
 */

import type { FieldMeta } from "../types.ts";
import type { ParsedXmlValue } from "./types.ts";

/**
 * Helper to extract local name from a potentially namespaced element name
 * @param name - Element name (e.g., "xs:element" or "element")
 * @returns Local name without namespace prefix (e.g., "element")
 */
export function getLocalName(name: string): string {
  const colonIndex = name.indexOf(":");
  return colonIndex >= 0 ? name.substring(colonIndex + 1) : name;
}

/**
 * Extracts the order of child elements from preserveOrder parsed structure.
 * Returns an array of element names in the order they appear in the XML.
 *
 * @param preserveOrderArray - The parsed XML in preserveOrder format
 * @param elementName - The name of the root element to extract element order from
 * @returns An array of element names in order, or undefined if no elements found
 */
export function extractElementOrderFromPreserveOrder(
  preserveOrderArray: unknown,
  elementName: string
): string[] | undefined {
  if (!Array.isArray(preserveOrderArray)) return undefined;

  for (const item of preserveOrderArray) {
    if (!item || typeof item !== "object") continue;

    // Try to find the element data - may be with or without namespace prefix
    let elementData: unknown = undefined;
    for (const key of Object.keys(item as Record<string, unknown>)) {
      // Match either exact name or local name (after colon)
      if (key === elementName || getLocalName(key) === elementName) {
        elementData = (item as Record<string, unknown>)[key];
        break;
      }
    }
    
    if (!elementData || !Array.isArray(elementData)) continue;

    const elementOrder: string[] = [];

    for (const child of elementData) {
      if (!child || typeof child !== "object") continue;

      // Skip comments and text nodes
      if ((child as Record<string, unknown>)["#comment"] || (child as Record<string, unknown>)["#text"]) continue;

      // Extract element names (first key that's not a comment, text, or attribute)
      for (const key of Object.keys(child)) {
        if (key.startsWith("@_") || key === "#comment" || key === "#text") continue;
        elementOrder.push(getLocalName(key));
        break; // Only take the first element key
      }
    }

    return elementOrder.length > 0 ? elementOrder : undefined;
  }

  return undefined;
}

/**
 * Extracts element order from a nested element in preserveOrder structure.
 *
 * @param preserveOrderData - The preserveOrder parsed data
 * @param path - Array of element names representing the path
 * @returns Array of element names in order, or undefined if no elements found
 */
export function extractNestedElementOrder(
  preserveOrderData: unknown,
  path: string[]
): string[] | undefined {
  if (!Array.isArray(preserveOrderData) || path.length === 0) return undefined;
  let current: unknown = preserveOrderData;
  
  for (const elementName of path) {
    if (!Array.isArray(current)) return undefined;
    let found = false;
    
    // Look for the element - may be with or without namespace prefix
    for (const item of current) {
      if (!item || typeof item !== "object") continue;
      
      // Try to find element data - match either exact name or local name
      for (const key of Object.keys(item as Record<string, unknown>)) {
        if (key === elementName || getLocalName(key) === elementName) {
          current = (item as Record<string, unknown>)[key];
          found = true;
          break;
        }
      }
      
      if (found) break;
    }
    
    if (!found) return undefined;
  }
  
  if (!Array.isArray(current)) return undefined;
  
  const elementOrder: string[] = [];
  for (const child of current) {
    if (!child || typeof child !== "object") continue;

    // Skip comments and text nodes
    if ((child as Record<string, unknown>)["#comment"] || (child as Record<string, unknown>)["#text"]) continue;

    // Extract element names (skip attributes too)
    for (const key of Object.keys(child)) {
      if (key.startsWith("@_") || key === "#comment" || key === "#text") continue;
      elementOrder.push(getLocalName(key));
      break;
    }
  }
  
  return elementOrder.length > 0 ? elementOrder : undefined;
}

/**
 * Finds all occurrences of an element at a specific path in preserveOrder data.
 * Returns an array of preserveOrder data for each occurrence.
 * This is used for array elements where each item needs its own preserveOrder context.
 *
 * @param preserveOrderData - The preserveOrder parsed data
 * @param path - Array of element names representing the path
 * @returns Array of preserveOrder data for each occurrence
 */
export function findElementOccurrences(
  preserveOrderData: unknown,
  path: string[]
): unknown[] {
  if (!Array.isArray(preserveOrderData) || path.length === 0) return [];
  
  // Navigate to the parent path (all but the last element)
  let current: unknown = preserveOrderData;
  for (let i = 0; i < path.length - 1; i++) {
    const elementName = path[i];
    if (!Array.isArray(current)) return [];
    let found = false;
    
    for (const item of current) {
      if (!item || typeof item !== "object") continue;
      
      for (const key of Object.keys(item as Record<string, unknown>)) {
        if (key === elementName || getLocalName(key) === elementName) {
          current = (item as Record<string, unknown>)[key];
          found = true;
          break;
        }
      }
      
      if (found) break;
    }
    
    if (!found) return [];
  }
  
  // Now find all occurrences of the last element in the path
  if (!Array.isArray(current)) return [];
  const lastElement = path[path.length - 1];
  const occurrences: unknown[] = [];
  
  for (const item of current) {
    if (!item || typeof item !== "object") continue;
    
    for (const key of Object.keys(item as Record<string, unknown>)) {
      if (key === lastElement || getLocalName(key) === lastElement) {
        occurrences.push((item as Record<string, unknown>)[key]);
        break; // Only take the first matching key per item
      }
    }
  }
  
  return occurrences;
}

/**
 * Result entry returned by mergeElementsByDocumentOrder.
 * `value` is the parsed XML node, `occurrence` is the corresponding preserve-order
 * entry that carries nested comment and element-order metadata.
 */
export interface MergedElementEntry {
  value: ParsedXmlValue;
  occurrence: unknown | undefined;
}

/**
 * Rebuilds the merged value sequence in true document order when multiple
 * namespace-equivalent parser keys (e.g. `simpleType` and `xs:simpleType`) hold
 * values for the same logical field.
 *
 * The fast-xml-parser regular parse groups values by key, so iterating over
 * `keys` naively produces `[a,c,b,d]` instead of `[a,b,c,d]` for interleaved
 * occurrences.  The preserve-order tree, however, still lists children in
 * document order; this function uses that tree to recover the correct sequence
 * and simultaneously returns the per-item occurrence node so that nested
 * `_elementOrder` / `_comments` metadata is preserved.
 *
 * Falls back to simple concatenation (no occurrence context) when no
 * preserve-order data is available or when the path cannot be found.
 *
 * @param keys - All namespace-equivalent parser keys for the field (e.g. ["simpleType","xs:simpleType"])
 * @param localName - The local element name shared by all keys
 * @param valuesByKey - A record mapping each key to its raw parsed value(s)
 * @param preserveOrderData - The preserve-order tree from the comment parser
 * @param path - The path to the **parent** element in the preserve-order tree;
 *               the last segment is the parent element name, children are iterated within it
 * @returns Array of {value, occurrence} in document order
 */
export function mergeElementsByDocumentOrder(
  keys: string[],
  localName: string,
  valuesByKey: Record<string, unknown>,
  preserveOrderData: unknown,
  path: string[]
): MergedElementEntry[] {
  // Build per-key queues from the flat parsed values
  const queues = new Map<string, unknown[]>();
  for (const k of keys) {
    const raw = valuesByKey[k];
    if (raw === undefined) continue;
    queues.set(k, Array.isArray(raw) ? [...raw] : [raw]);
  }

  const totalCount = [...queues.values()].reduce((s, q) => s + q.length, 0);
  if (totalCount === 0) return [];

  // Try to walk the preserve-order tree to recover document order
  if (Array.isArray(preserveOrderData) && path.length > 0) {
    // Navigate to the parent node's children array in the preserve-order tree
    let current: unknown = preserveOrderData;
    for (const segment of path) {
      if (!Array.isArray(current)) { current = undefined; break; }
      let found = false;
      for (const item of current as unknown[]) {
        if (!item || typeof item !== "object") continue;
        for (const key of Object.keys(item as Record<string, unknown>)) {
          if (key === segment || getLocalName(key) === segment) {
            current = (item as Record<string, unknown>)[key];
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (!found) { current = undefined; break; }
    }

    if (Array.isArray(current)) {
      const result: MergedElementEntry[] = [];
      for (const child of current as unknown[]) {
        if (!child || typeof child !== "object") continue;
        for (const childKey of Object.keys(child as Record<string, unknown>)) {
          if (childKey.startsWith("@_") || childKey === "#text" || childKey === "#comment") continue;
          const childLocal = getLocalName(childKey);
          if (childLocal !== localName) continue;
          // Find which parser key this preserve-order child key corresponds to.
          // Prefer an exact key match (e.g. "ns:Item" → "ns:Item" queue) so that
          // interleaved prefixed/unprefixed occurrences are dequeued from the correct
          // per-key queue and maintain document order.
          const exactMatch = queues.get(childKey);
          if (exactMatch && exactMatch.length > 0) {
            result.push({
              value: exactMatch.shift() as ParsedXmlValue,
              occurrence: (child as Record<string, unknown>)[childKey],
            });
          } else {
            // Fall back to any queue with a matching local name (same namespace alias)
            for (const k of keys) {
              const queue = queues.get(k);
              if (!queue || queue.length === 0) continue;
              if (getLocalName(k) === childLocal) {
                result.push({
                  value: queue.shift() as ParsedXmlValue,
                  occurrence: (child as Record<string, unknown>)[childKey],
                });
                break;
              }
            }
          }
          break;
        }
      }
      // Return the result from the preserve-order walk. Any values not consumed by the
      // walk (e.g. because the preserve-order tree was incomplete) are appended without
      // occurrence context so no data is lost.
      if (result.length > 0) {
        for (const k of keys) {
          const queue = queues.get(k);
          if (!queue) continue;
          for (const v of queue) result.push({ value: v as ParsedXmlValue, occurrence: undefined });
        }
        return result;
      }
      // Walk produced nothing — fall through to simple concatenation
    }
  }

  // Fallback: simple concatenation without occurrence context
  const result: MergedElementEntry[] = [];
  for (const k of keys) {
    const queue = queues.get(k);
    if (!queue) continue;
    for (const v of queue) result.push({ value: v as ParsedXmlValue, occurrence: undefined });
  }
  return result;
}

/**
 * Sort element fields by the stored element order
 * @param elementFields - Array of field metadata for element fields
 * @param elementOrder - Array of element names in the desired order
 * @returns Sorted array of field metadata
 */
export function sortFieldsByElementOrder(
  elementFields: FieldMeta[],
  elementOrder: string[] | undefined
): FieldMeta[] {
  if (!elementOrder || elementOrder.length === 0) {
    return elementFields;
  }

  // Create a map of element name to its first position in elementOrder
  const orderMap = new Map<string, number>();
  elementOrder.forEach((name, index) => {
    const localName = getLocalName(name);
    if (!orderMap.has(localName)) {
      orderMap.set(localName, index);
    }
  });

  // Sort fields: those in elementOrder come first (by position), others come after (in original order)
  const inOrder: Array<{ field: FieldMeta; position: number }> = [];
  const notInOrder: FieldMeta[] = [];

  elementFields.forEach(field => {
    const fieldName = field.name || field.key;
    const localName = getLocalName(fieldName);
    const position = orderMap.get(localName);
    
    if (position !== undefined) {
      inOrder.push({ field, position });
    } else {
      notInOrder.push(field);
    }
  });

  // Sort fields in elementOrder by their position
  inOrder.sort((a, b) => a.position - b.position);

  return [...inOrder.map(item => item.field), ...notInOrder];
}
