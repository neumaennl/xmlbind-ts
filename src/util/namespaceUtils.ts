/**
 * Utility functions for handling XML namespaces.
 */

/**
 * Checks if an attribute name is a namespace declaration.
 * Namespace declarations (xmlns and xmlns:*) are handled by the namespace context
 * and should not be included in wildcard attributes.
 *
 * @param attrName - The attribute name to check
 * @returns True if the attribute is a namespace declaration
 */
export function isNamespaceDeclaration(attrName: string): boolean {
  return attrName === "xmlns" || attrName.startsWith("xmlns:");
}
