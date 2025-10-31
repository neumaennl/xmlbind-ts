import { ensureMeta } from "../metadata/MetadataRegistry";

/**
 * Decorator to mark a property as a wildcard attribute container (xs:anyAttribute).
 *
 * This property will capture any XML attributes that are not explicitly
 * mapped by other @XmlAttribute decorators. The property should be typed as
 * { [name: string]: string }.
 *
 * @returns A property decorator function
 *
 * @example
 * ```typescript
 * class FlexibleElement {
 *   @XmlAttribute('id')
 *   id?: string;
 *
 *   @XmlAnyAttribute()
 *   additionalAttributes?: { [name: string]: string };
 * }
 * ```
 */
export function XmlAnyAttribute() {
  return function (contextOrTarget: any, propertyKey?: string | symbol) {
    if (typeof propertyKey === "string" || typeof propertyKey === "symbol") {
      const target = contextOrTarget as any;
      const ctor = target.constructor;
      const m = ensureMeta(ctor);
      m.fields.push({
        key: propertyKey.toString(),
        name: "*",
        kind: "anyAttribute",
      } as any);
      return;
    }
    return function (target: any, prop: string | symbol) {
      const ctor = target.constructor;
      const m = ensureMeta(ctor);
      m.fields.push({
        key: prop.toString(),
        name: "*",
        kind: "anyAttribute",
      } as any);
    };
  } as any;
}
