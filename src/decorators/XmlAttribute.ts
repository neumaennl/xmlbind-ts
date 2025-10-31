import { ensureMeta } from "../metadata/MetadataRegistry";

/**
 * Decorator to mark a property as an XML attribute.
 *
 * This decorator registers metadata for marshalling/unmarshalling a class property
 * to/from an XML attribute. Attributes are always scalar values (not arrays).
 *
 * @param name - The XML attribute name (defaults to property name)
 * @param options - Optional configuration
 * @param options.namespace - The XML namespace URI for the attribute
 * @returns A property decorator function
 *
 * @example
 * ```typescript
 * class Person {
 *   @XmlAttribute('id')
 *   id?: string;
 *
 *   @XmlAttribute('age')
 *   age?: number;
 * }
 * ```
 */
export function XmlAttribute(name?: string, options?: { namespace?: string }) {
  return function (contextOrTarget: any, propertyKey?: string | symbol) {
    if (typeof propertyKey === "string" || typeof propertyKey === "symbol") {
      const target = contextOrTarget as any;
      const ctor = target.constructor;
      const m = ensureMeta(ctor);
      m.fields.push({
        key: propertyKey.toString(),
        name: name ?? propertyKey.toString(),
        kind: "attribute",
        namespace: options?.namespace ?? null,
      });
      return;
    }
    return function (target: any, prop: string | symbol) {
      const ctor = target.constructor;
      const m = ensureMeta(ctor);
      m.fields.push({
        key: prop.toString(),
        name: name ?? prop.toString(),
        kind: "attribute",
        namespace: options?.namespace ?? null,
      });
    };
  } as any;
}
