import { ensureMeta } from "../metadata/MetadataRegistry";

/**
 * Decorator to mark a property as a wildcard element container (xs:any).
 *
 * This property will capture any XML child elements that are not explicitly
 * mapped by other @XmlElement decorators. The property should be typed as unknown[].
 *
 * @returns A property decorator function
 *
 * @example
 * ```typescript
 * class FlexibleContainer {
 *   @XmlElement('KnownField')
 *   knownField?: string;
 *
 *   @XmlAnyElement()
 *   additionalElements?: unknown[];
 * }
 * ```
 */
export function XmlAnyElement() {
  return function (contextOrTarget: any, propertyKey?: string | symbol) {
    if (typeof propertyKey === "string" || typeof propertyKey === "symbol") {
      const target = contextOrTarget as any;
      const ctor = target.constructor;
      const m = ensureMeta(ctor);
      m.fields.push({
        key: propertyKey.toString(),
        name: "*",
        kind: "anyElement",
        isArray: true,
      } as any);
      return;
    }
    return function (target: any, prop: string | symbol) {
      const ctor = target.constructor;
      const m = ensureMeta(ctor);
      m.fields.push({
        key: prop.toString(),
        name: "*",
        kind: "anyElement",
        isArray: true,
      } as any);
    };
  } as any;
}
