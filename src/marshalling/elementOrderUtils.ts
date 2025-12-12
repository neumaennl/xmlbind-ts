/**
 * Utilities for preserving XML element order during unmarshal/marshal roundtrip
 */

import type { FieldMeta } from "../types";

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
