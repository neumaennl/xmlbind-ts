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
  return function (contextOrTarget: any, propertyKeyOrContext?: string | symbol | any) {
    // Stage 3 decorators: contextOrTarget is undefined/value, propertyKeyOrContext is context object
    if (propertyKeyOrContext && typeof propertyKeyOrContext === "object" && "kind" in propertyKeyOrContext) {
      const context = propertyKeyOrContext;
      context.addInitializer(function(this: any) {
        const ctor = this.constructor;
        const m = ensureMeta(ctor);
        m.fields.push({
          key: context.name.toString(),
          name: "*",
          kind: "anyElement",
          isArray: true,
        } as any);
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
      m.fields.push({
        key: propertyKeyOrContext.toString(),
        name: "*",
        kind: "anyElement",
        isArray: true,
      } as any);
      return;
    }
    
    // Fallback for other decorator patterns
    return function (target: any, prop: string | symbol) {
      if (!target || !target.constructor) {
        return;
      }
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
