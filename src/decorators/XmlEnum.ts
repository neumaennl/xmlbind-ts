import { ensureMeta } from "../metadata/MetadataRegistry";

/**
 * Decorator to mark a property as containing an enum type for validation.
 *
 * This decorator associates an enum type with a property's metadata,
 * which can be used for runtime validation and type checking during
 * marshalling/unmarshalling operations.
 *
 * @param enumType - The TypeScript enum object to associate with the property
 * @returns A property decorator function
 *
 * @example
 * ```typescript
 * enum Priority {
 *   Low = "low",
 *   High = "high"
 * }
 *
 * class Task {
 *   @XmlElement('priority')
 *   @XmlEnum(Priority)
 *   priority?: Priority;
 * }
 * ```
 */
export function XmlEnum(enumType: any) {
  return function (contextOrTarget: any, propertyKey?: string | symbol) {
    if (typeof propertyKey === "string" || typeof propertyKey === "symbol") {
      const target = contextOrTarget as any;
      const ctor = target.constructor;
      const m = ensureMeta(ctor);
      // Store enum type in metadata - can be used for validation
      const existing = m.fields.find((f) => f.key === propertyKey.toString());
      if (existing) {
        (existing as any).enumType = enumType;
      }
      return;
    }
    return function (target: any, prop: string | symbol) {
      const ctor = target.constructor;
      const m = ensureMeta(ctor);
      const existing = m.fields.find((f) => f.key === prop.toString());
      if (existing) {
        (existing as any).enumType = enumType;
      }
    };
  } as any;
}
