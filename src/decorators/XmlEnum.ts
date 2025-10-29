import { ensureMeta } from "../metadata/MetadataRegistry";

/**
 * Decorator for marking a property as an enum type.
 * This is used to indicate that the property should be validated
 * against a set of predefined enum values.
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
