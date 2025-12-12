/**
 * Utilities for preserving XML comments during unmarshal/marshal roundtrip
 */

import { getLocalName } from "./elementOrderUtils";

/**
 * Extracts comments with position information from preserveOrder parsed structure.
 * Returns an array of {comment: string, position: number} objects where position
 * indicates the index where the comment should appear relative to child elements.
 *
 * @param preserveOrderArray - The parsed XML in preserveOrder format
 * @param elementName - The name of the root element to extract comments from
 * @returns An array of comment objects with positions, or undefined if no comments found
 */
export function extractCommentsFromPreserveOrder(
  preserveOrderArray: any,
  elementName: string
): Array<{text: string; position: number}> | undefined {
  if (!Array.isArray(preserveOrderArray)) return undefined;

  for (const item of preserveOrderArray) {
    if (!item || typeof item !== "object") continue;

    // Try exact match first, then local name match (for namespaced elements)
    let elementData = item[elementName];
    if (!elementData) {
      // Check if any key in item has a local name matching elementName
      for (const key of Object.keys(item)) {
        if (getLocalName(key) === elementName) {
          elementData = item[key];
          break;
        }
      }
    }
    if (!elementData || !Array.isArray(elementData)) continue;

    const comments: Array<{text: string; position: number}> = [];
    let elementIndex = 0;

    for (const child of elementData) {
      if (!child || typeof child !== "object") continue;

      // Check if this is a comment node
      if (child["#comment"]) {
        const commentData = child["#comment"];
        if (Array.isArray(commentData) && commentData[0]) {
          const commentText = commentData[0]["#text"];
          if (typeof commentText === "string") {
            comments.push({ text: commentText, position: elementIndex });
          }
        }
      } else if (!child["#text"]) {
        // Non-whitespace element, increment position counter
        elementIndex++;
      }
    }

    return comments.length > 0 ? comments : undefined;
  }

  return undefined;
}

/**
 * Extracts comments from a nested element in preserveOrder structure.
 *
 * @param preserveOrderData - The preserveOrder parsed data
 * @param path - Array of element names representing the path
 * @returns Array of comment objects with positions, or undefined if no comments found
 */
export function extractNestedComments(
  preserveOrderData: any,
  path: string[]
): Array<{text: string; position: number}> | undefined {
  if (!Array.isArray(preserveOrderData) || path.length === 0) return undefined;
  let current = preserveOrderData;
  for (const elementName of path) {
    if (!Array.isArray(current)) return undefined;
    let found = false;
    for (const item of current) {
      if (item && typeof item === "object") {
        // Try exact match first
        if (item[elementName]) {
          current = item[elementName];
          found = true;
          break;
        }
        // Try local name match for namespaced elements
        for (const key of Object.keys(item)) {
          if (getLocalName(key) === elementName) {
            current = item[key];
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }
    if (!found) return undefined;
  }
  if (!Array.isArray(current)) return undefined;
  const comments: Array<{text: string; position: number}> = [];
  let elementIndex = 0;
  for (const child of current) {
    if (!child || typeof child !== "object") continue;
    if (child["#comment"]) {
      const commentData = child["#comment"];
      if (Array.isArray(commentData) && commentData[0]) {
        const commentText = commentData[0]["#text"];
        if (typeof commentText === "string") {
          comments.push({ text: commentText, position: elementIndex });
        }
      }
    } else if (!child["#text"]) {
      elementIndex++;
    }
  }
  return comments.length > 0 ? comments : undefined;
}

/**
 * Extracts document-level comments (comments before the root element).
 * These are comments that appear at the top of the XML file, before the root element starts.
 *
 * @param preserveOrderArray - The parsed XML in preserveOrder format
 * @param rootElementName - The name of the root element
 * @returns An array of comment texts in order, or undefined if no comments found
 */
export function extractDocumentLevelComments(
  preserveOrderArray: unknown,
  rootElementName: string
): string[] | undefined {
  if (!Array.isArray(preserveOrderArray)) return undefined;

  const documentComments: string[] = [];
  
  for (const item of preserveOrderArray) {
    if (!item || typeof item !== "object") continue;
    
    // Check if this is a comment node
    const commentData = (item as Record<string, unknown>)["#comment"];
    if (commentData) {
      // Comment data is an array with { "#text": "comment text" } structure
      if (Array.isArray(commentData) && commentData.length > 0) {
        const textNode = commentData[0];
        if (textNode && typeof textNode === "object" && "#text" in textNode) {
          documentComments.push(String((textNode as Record<string, unknown>)["#text"]));
        }
      }
      continue;
    }
    
    // Check if we've reached the root element (with or without namespace prefix)
    for (const key of Object.keys(item as Record<string, unknown>)) {
      if (key === rootElementName || getLocalName(key) === rootElementName) {
        // We've reached the root element, stop collecting comments
        return documentComments.length > 0 ? documentComments : undefined;
      }
    }
  }
  
  return documentComments.length > 0 ? documentComments : undefined;
}

/**
 * Check if comments data contains positioned comments
 * @param commentsData - Comments data from object
 * @returns True if positioned comments exist
 */
export function hasPositionedComments(commentsData: any): boolean {
  return commentsData && Array.isArray(commentsData) && commentsData.length > 0 &&
    typeof commentsData[0] === 'object' && 'text' in commentsData[0] && 'position' in commentsData[0];
}

/**
 * Group comments by their position for insertion during marshalling
 * @param commentsData - Array of comment objects with text and position
 * @returns Map of position to array of comment texts
 */
export function groupCommentsByPosition(
  commentsData: Array<{ text: string; position: number }>
): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const comment of commentsData) {
    const existing = map.get(comment.position) || [];
    existing.push(comment.text);
    map.set(comment.position, existing);
  }
  return map;
}
