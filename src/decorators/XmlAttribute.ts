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
  return function (contextOrTarget: any, propertyKeyOrContext?: string | symbol | any) {
    // Stage 3 decorators: contextOrTarget is undefined/value, propertyKeyOrContext is context object
    if (propertyKeyOrContext && typeof propertyKeyOrContext === "object" && "kind" in propertyKeyOrContext) {
      const context = propertyKeyOrContext;
      context.addInitializer(function(this: any) {
        const ctor = this.constructor;
        const m = ensureMeta(ctor);
        m.fields.push({
          key: context.name.toString(),
          name: name ?? context.name.toString(),
          kind: "attribute",
          namespace: options?.namespace ?? null,
        });
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
        name: name ?? propertyKeyOrContext.toString(),
        kind: "attribute",
        namespace: options?.namespace ?? null,
      });
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
        name: name ?? prop.toString(),
        kind: "attribute",
        namespace: options?.namespace ?? null,
      });
    };
  } as any;
}
