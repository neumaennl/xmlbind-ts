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
  return function (contextOrTarget: any, propertyKeyOrContext?: string | symbol | any) {
    // Stage 3 decorators: contextOrTarget is undefined/value, propertyKeyOrContext is context object
    if (propertyKeyOrContext && typeof propertyKeyOrContext === "object" && "kind" in propertyKeyOrContext) {
      const context = propertyKeyOrContext;
      context.addInitializer(function(this: any) {
        const ctor = this.constructor;
        const m = ensureMeta(ctor);
        const existing = m.fields.find((f) => f.key === context.name.toString());
        if (existing) {
          (existing as any).enumType = enumType;
        }
      });
      return;
    }
    
    // Legacy decorators: contextOrTarget is the target, propertyKeyOrContext is the property key
    if (typeof propertyKeyOrContext === "string" || typeof propertyKeyOrContext === "symbol") {
      const target = contextOrTarget as any;
      if (!target || !target.constructor) {
        return;
      }
      const ctor = target.constructor;
      const m = ensureMeta(ctor);
      const existing = m.fields.find((f) => f.key === propertyKeyOrContext.toString());
      if (existing) {
        (existing as any).enumType = enumType;
      }
      return;
    }
    
    // Fallback for other decorator patterns
    return function (target: any, prop: string | symbol) {
      if (!target || !target.constructor) {
        return;
      }
      const ctor = target.constructor;
      const m = ensureMeta(ctor);
      const existing = m.fields.find((f) => f.key === prop.toString());
      if (existing) {
        (existing as any).enumType = enumType;
      }
    };
  } as any;
}
