import { ensureMeta } from "../metadata/MetadataRegistry";

/**
 * Decorator to mark a class as an XML root element.
 *
 * This decorator registers the class with XML marshalling/unmarshalling metadata,
 * specifying the root element name and optional namespace configuration.
 *
 * @param name - The XML element name for the root (defaults to class name)
 * @param options - Optional configuration
 * @param options.namespace - The default XML namespace URI for the root element
 * @param options.prefixes - Map of namespace URIs to preferred prefixes
 * @returns A class decorator function
 *
 * @example
 * ```typescript
 * @XmlRoot('Person', { namespace: 'http://example.com/ns' })
 * class Person {
 *   // ...
 * }
 * ```
 */
export function XmlRoot(
  name?: string,
  options?: { namespace?: string; prefixes?: Record<string, string> }
) {
  return function (contextOrCtor: any) {
    if (typeof contextOrCtor === "function") {
      const ctor = contextOrCtor as any;
      const m = ensureMeta(ctor);
      m.rootName = name ?? ctor.name;
      m.namespace = options?.namespace ?? null;
      m.prefixes = options?.prefixes;
      return;
    }
    return function (ctor: any) {
      const m = ensureMeta(ctor);
      m.rootName = name ?? ctor.name;
      m.namespace = options?.namespace ?? null;
      m.prefixes = options?.prefixes;
    };
  } as any;
}
