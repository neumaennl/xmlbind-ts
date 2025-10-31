import { ensureMeta } from "../metadata/MetadataRegistry";

/**
 * Decorator to mark a property as an XML element.
 *
 * This decorator registers metadata for marshalling/unmarshalling a class property
 * to/from an XML child element. Supports arrays, custom types, namespaces, and nillable elements.
 *
 * @param name - The XML element name (defaults to property name)
 * @param options - Optional configuration
 * @param options.type - The TypeScript type constructor for the element (required for complex types)
 * @param options.array - Whether the element can occur multiple times (array)
 * @param options.namespace - The XML namespace URI for the element
 * @param options.nillable - Whether the element can be explicitly null (xsi:nil)
 * @returns A property decorator function
 *
 * @example
 * ```typescript
 * class Person {
 *   @XmlElement('Name')
 *   name?: string;
 *
 *   @XmlElement('Address', { type: Address, array: true })
 *   addresses?: Address[];
 * }
 * ```
 */
export function XmlElement(
  name?: string,
  options?: {
    type?: any;
    array?: boolean;
    namespace?: string;
    nillable?: boolean;
  }
) {
  return function (contextOrTarget: any, propertyKey?: string | symbol) {
    if (typeof propertyKey === "string" || typeof propertyKey === "symbol") {
      const target = contextOrTarget as any;
      const ctor = target.constructor;
      const m = ensureMeta(ctor);
      m.fields.push({
        key: propertyKey.toString(),
        name: name ?? propertyKey.toString(),
        kind: "element",
        type: options?.type,
        isArray: !!options?.array,
        namespace: options?.namespace ?? null,
        nillable: !!options?.nillable,
      });
      return;
    }
    return function (target: any, prop: string | symbol) {
      const ctor = target.constructor;
      const m = ensureMeta(ctor);
      m.fields.push({
        key: prop.toString(),
        name: name ?? prop.toString(),
        kind: "element",
        type: options?.type,
        isArray: !!options?.array,
        namespace: options?.namespace ?? null,
        nillable: !!options?.nillable,
      });
    };
  } as any;
}
