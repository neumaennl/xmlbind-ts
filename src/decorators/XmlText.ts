import { ensureMeta, registerStage3Field } from "../metadata/MetadataRegistry.js";
import { resolveFieldType } from "./fieldType.js";

/**
 * Decorator to mark a property as containing the text content of an XML element.
 *
 * This is used for elements that have text content, possibly along with attributes.
 * Only one property per class should have this decorator.
 *
 * When `emitDecoratorMetadata` is enabled in `tsconfig.json` (legacy decorators),
 * the type is read from the field's declaration, so a `number` field gets a
 * number. Stage 3 decorators get no type information; without `options.type`
 * the text stays a string.
 *
 * @param options - Optional configuration
 * @param options.type - Explicit type constructor (`String`, `Number`, `Boolean` or `Date`).
 *   Takes precedence over the type from the field's declaration.
 * @param options.allowStringFallback - When `true`, non-coercible values are returned
 *   as their original string rather than producing `NaN` (for `Number`) or `false`
 *   (for `Boolean`).  Use this for union types like `number | "unbounded"`.
 * @returns A property decorator function
 * @throws {TypeError} With legacy decorators, if `options.type` contradicts the
 *   declared type of the field
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
 *
 * class Price {
 *   @XmlText({ type: Number })
 *   amount?: number;
 * }
 * // &lt;Price>1.50&lt;/Price> gives amount 1.5
 * ```
 */
export function XmlText(options?: { type?: any; allowStringFallback?: boolean }) {
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
      registerStage3Field(context, (fields) => {
        fields.push({
          key: context.name.toString(),
          name: context.name.toString(),
          kind: "text",
          type: options?.type,
          namespace: null,
          allowStringFallback: options?.allowStringFallback,
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
        type: resolveFieldType("@XmlText", options, target, propertyKeyOrContext, [Object]),
        namespace: null,
        allowStringFallback: options?.allowStringFallback,
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
        type: resolveFieldType("@XmlText", options, target, prop, [Object]),
        namespace: null,
        allowStringFallback: options?.allowStringFallback,
      });
    };
  } as any;
}
