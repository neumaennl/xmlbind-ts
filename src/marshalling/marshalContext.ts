/**
 * Namespace context and helper functions for marshalling
 */

export type NsContext = {
  defaultNs?: string;
  // Map from namespace URI to prefix
  uriToPrefix: Map<string, string>;
  // Set of prefixes already declared on root
  declared: Set<string>;
  // Root node to which xmlns declarations are attached
  rootNode: any;
  counter: number;
  /**
   * True when the marshalled object has `_namespacePrefixes` set (populated by
   * `unmarshal` or written directly by the caller). When true, that map is
   * treated as the authoritative set of namespace declarations for *known*
   * namespaces, and helpers such as `mergeChildPrefixes` must not inject
   * additional `xmlns:` declarations for those namespaces that would otherwise
   * be captured by a subsequent `unmarshal` call and cause the two
   * `_namespacePrefixes` values to differ. Note that marshalling may still
   * introduce new `xmlns:` declarations for previously unseen namespaces.
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
    ctx.rootNode[`@_xmlns:${p}`] = ns;
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

/**
 * Adds a child element to a node, handling multiple elements with the same name.
 * If a child with the same key already exists, converts it to an array.
 *
 * @param node - The parent node
 * @param key - The element key/name
 * @param value - The value to add
 */
export function addChild(node: any, key: string, value: any): void {
  const existing = node[key];
  if (existing === undefined) {
    node[key] = value;
  } else if (Array.isArray(existing)) {
    existing.push(value);
  } else {
    node[key] = [existing, value];
  }
}

/**
 * Writes wildcard elements (xs:any) to a node.
 * Merges object properties as child elements directly into the parent node.
 *
 * @param node - The parent node to add elements to
 * @param anyArr - Array of wildcard elements (objects or primitives)
 */
export function writeAnyElements(node: any, anyArr: unknown[]): void {
  if (!Array.isArray(anyArr)) return;
  for (const item of anyArr) {
    if (item == null) continue;
    if (typeof item === "object" && !Array.isArray(item)) {
      const obj = item as Record<string, any>;
      for (const k of Object.keys(obj)) {
        addChild(node, k, obj[k]);
      }
    }
  }
}

/**
 * Post-processes XML to convert <#comment>...</#comment> and <#comment0>...</#comment0> tags to <!-- ... --> comments.
 * This is required because XMLBuilder without commentPropName outputs comment nodes as elements.
 *
 * @param xml - The XML string with <#comment> or <#commentN> tags
 * @returns The XML string with proper <!-- --> comment syntax
 */
export function postProcessComments(xml: string): string {
  return xml.replace(
    /<#comment\d*>([^<]*(?:<(?!\/#comment\d*>)[^<]*)*)<\/#comment\d*>/g,
    "<!--$1-->"
  );
}
