import "reflect-metadata";
import { ensureMeta } from "../metadata/MetadataRegistry";

/**
 * Resolves the type for an attribute field: the explicit `options.type` takes
 * precedence; otherwise the TypeScript design type emitted by the compiler
 * (when `emitDecoratorMetadata: true`) is used via `reflect-metadata`.
 *
 * Throws a TypeError when an explicit `options.type` is provided but conflicts
 * with the concrete TypeScript design type (e.g. `{ type: Number }` on a
 * `string` property). When the design type is `Object` — which TypeScript emits
 * for union types such as `number | "unbounded"` — no conflict is reported,
 * because the explicit type is a valid member of the union.
 */
function resolveAttributeType(
  options: { type?: any } | undefined,
  target: object,
  propertyKey: string | symbol
): any {
  const reflectedType = Reflect.getMetadata("design:type", target, propertyKey);
  if (
    options?.type !== undefined &&
    reflectedType !== undefined &&
    reflectedType !== Object &&
    options.type !== reflectedType
  ) {
    throw new TypeError(
      `@XmlAttribute: explicit type option "${options.type?.name}" conflicts with the` +
      ` declared TypeScript type "${reflectedType?.name}" for property` +
      ` "${String(propertyKey)}". Remove the type option or align it with the property declaration.`
    );
  }
  return options?.type ?? reflectedType;
}

/**
 * Decorator to mark a property as an XML attribute.
 *
 * This decorator registers metadata for marshalling/unmarshalling a class property
 * to/from an XML attribute. Attributes are always scalar values (not arrays).
 *
 * When `emitDecoratorMetadata` is enabled in `tsconfig.json` (legacy decorators),
 * the TypeScript design type is read automatically via `reflect-metadata`, so numeric
 * and boolean attributes are coerced to the correct primitive at deserialisation time
 * without any extra configuration.
 *
 * @param name - The XML attribute name (defaults to property name)
 * @param options - Optional configuration
 * @param options.namespace - The XML namespace URI for the attribute
 * @param options.type - Explicit type constructor override (e.g. `Number`, `Boolean`).
 *   Takes precedence over the automatically detected design type.  Useful for Stage 3
 *   decorators where `reflect-metadata` design types are not emitted.
 * @returns A property decorator function
 *
 * @example
 * ```typescript
 * class Person {
 *   @XmlAttribute('id')
 *   id?: string;
 *
 *   // With emitDecoratorMetadata the Number type is detected automatically:
 *   @XmlAttribute('age')
 *   age?: number;
 *
 *   // Or supply the type explicitly (e.g. for Stage 3 decorators):
 *   @XmlAttribute('score', { type: Number })
 *   score?: number;
 * }
 * ```
 */
export function XmlAttribute(name?: string, options?: { namespace?: string; type?: any }) {
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
          type: options?.type,
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
        type: resolveAttributeType(options, target, propertyKeyOrContext),
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
        type: resolveAttributeType(options, target, prop),
        namespace: options?.namespace ?? null,
      });
    };
  } as any;
}
