/**
 * Namespace context and helper functions for marshalling
 */
import type { XmlAttributes } from "./xmlTree.js";

export type NsContext = {
  defaultNs?: string;
  // Map from namespace URI to prefix
  uriToPrefix: Map<string, string>;
  // Set of prefixes already declared on root
  declared: Set<string>;
  // Attributes of the root element, to which xmlns declarations are added
  rootAttributes: XmlAttributes;
  counter: number;
  /**
   * True when the marshalled object has `_namespacePrefixes` set (populated by
   * `unmarshal` or written directly by the caller). When true, that map is
   * treated as the authoritative set of namespace declarations for *known*
   * namespaces, including the default namespace under the empty prefix. Helpers
   * such as `mergeChildPrefixes` must not inject additional declarations for
   * those namespaces that would otherwise be captured by a subsequent `unmarshal`
   * call and cause the two `_namespacePrefixes` values to differ. Marshalling may
   * still introduce new `xmlns:` declarations for previously unseen namespaces.
   */
  hasExplicitPrefixes: boolean;
};

/**
 * Ensures a namespace prefix exists for the given namespace URI.
 * If no prefix exists, generates a new one and declares it on the root element.
 *
 * @param ns - The namespace URI
 * @param ctx - The namespace context containing prefix mappings
 * @returns The prefix for the given namespace
 */
export function ensurePrefix(ns: string, ctx: NsContext): string {
  let p = ctx.uriToPrefix.get(ns);
  if (p) return p;
  p = `ns${++ctx.counter}`;
  ctx.uriToPrefix.set(ns, p);
  // declare on root if not already
  if (!ctx.declared.has(p)) {
    ctx.rootAttributes[`xmlns:${p}`] = ns;
    ctx.declared.add(p);
  }
  return p;
}

/**
 * Constructs a qualified XML name (QName) with the appropriate namespace prefix.
 * Handles default namespace and special rules for attributes (which don't use default namespace).
 *
 * @param local - The local name of the element or attribute
 * @param ns - The namespace URI (optional)
 * @param ctx - The namespace context
 * @param isAttribute - Whether this is an attribute name (default: false)
 * @returns The qualified name with prefix, or just the local name if no namespace
 */
export function qName(
  local: string,
  ns: string | undefined,
  ctx: NsContext,
  isAttribute = false
): string {
  if (!ns) return local;
  // default namespace never applies to attributes; force prefix if attribute
  if (!isAttribute && ctx.defaultNs && ns === ctx.defaultNs) {
    return local;
  }
  const prefix = ensurePrefix(ns, ctx);
  return `${prefix}:${local}`;
}
