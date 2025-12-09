import { ensureMeta } from "../metadata/MetadataRegistry";

/**
 * Decorator to mark a property as containing the text content of an XML element.
 *
 * This is used for elements that have text content, possibly along with attributes.
 * Only one property per class should have this decorator.
 *
 * @returns A property decorator function
 *
 * @example
 * ```typescript
 * class Comment {
 *   @XmlAttribute('author')
 *   author?: string;
 *
 *   @XmlText()
 *   text?: string;
 * }
 * // Maps to: &lt;Comment author="John">Hello World&lt;/Comment>
 * ```
 */
export function XmlText() {
  return function (
    contextOrTarget: any,
    propertyKeyOrContext?: string | symbol | any
  ) {
    // Stage 3 decorators: contextOrTarget is undefined/value, propertyKeyOrContext is context object
    if (
      propertyKeyOrContext &&
      typeof propertyKeyOrContext === "object" &&
      "kind" in propertyKeyOrContext
    ) {
      const context = propertyKeyOrContext;
      context.addInitializer(function (this: any) {
        const ctor = this.constructor;
        const m = ensureMeta(ctor);
        m.fields.push({
          key: context.name.toString(),
          name: context.name.toString(),
          kind: "text",
          namespace: null,
        });
      });
      return;
    }

    // Legacy decorators: contextOrTarget is the target, propertyKeyOrContext is the property key
    if (
      typeof propertyKeyOrContext === "string" ||
      typeof propertyKeyOrContext === "symbol"
    ) {
      const target = contextOrTarget as any;
      if (!target || !target.constructor) {
        return;
      }
      const ctor = target.constructor;
      const m = ensureMeta(ctor);
      m.fields.push({
        key: propertyKeyOrContext.toString(),
        name: propertyKeyOrContext.toString(),
        kind: "text",
        namespace: null,
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
        name: prop.toString(),
        kind: "text",
        namespace: null,
      });
    };
  } as any;
}
