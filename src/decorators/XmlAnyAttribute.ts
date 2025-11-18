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
  return function (contextOrTarget: any, propertyKeyOrContext?: string | symbol | any) {
    // Stage 3 decorators: contextOrTarget is undefined/value, propertyKeyOrContext is context object
    if (propertyKeyOrContext && typeof propertyKeyOrContext === "object" && "kind" in propertyKeyOrContext) {
      const context = propertyKeyOrContext;
      // For Stage 3 decorators, register metadata when the class instance is created
      context.addInitializer(function(this: any) {
        const ctor = this.constructor;
        const m = ensureMeta(ctor);
        m.fields.push({
          key: context.name.toString(),
          name: "*",
          kind: "anyAttribute",
        } as any);
      });
      return;
    }
    
    // Legacy decorators: contextOrTarget is the target, propertyKeyOrContext is the property key
    if (typeof propertyKeyOrContext === "string" || typeof propertyKeyOrContext === "symbol") {
      const target = contextOrTarget as any;
      // Defensive check: ensure target exists and has a constructor
      if (!target || !target.constructor) {
        return;
      }
      const ctor = target.constructor;
      const m = ensureMeta(ctor);
      m.fields.push({
        key: propertyKeyOrContext.toString(),
        name: "*",
        kind: "anyAttribute",
      } as any);
      return;
    }
    
    // Fallback for other decorator patterns
    return function (target: any, prop: string | symbol) {
      // Defensive check: ensure target exists and has a constructor
      if (!target || !target.constructor) {
        return;
      }
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
