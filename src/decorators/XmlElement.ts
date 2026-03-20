import "reflect-metadata";
import { ensureMeta } from "../metadata/MetadataRegistry";
import { resolveType } from "../util/typeResolution";

/**
 * Resolves the type for an element field: the explicit `options.type` takes
 * precedence; otherwise the TypeScript design type emitted by the compiler
 * (when `emitDecoratorMetadata: true`) is used via `reflect-metadata`.
 *
 * Array properties emit `Array` as the design type, which is not useful as an
 * element type, so it is skipped.  Union types emit `Object`, which is also
 * skipped to avoid masking the explicitly provided type.
 *
 * Throws a TypeError when an explicit `options.type` is provided but conflicts
 * with the concrete TypeScript design type (e.g. `{ type: Number }` on a
 * `string` property).  Lazy type references such as `{ type: () => MyClass }`
 * are resolved before comparison, so circular-dependency patterns work correctly.
 */
function resolveElementType(
  options: { type?: any } | undefined,
  target: object,
  propertyKey: string | symbol
): any {
  const reflectedType = Reflect.getMetadata("design:type", target, propertyKey);
  // Resolve any lazy reference (e.g. `() => MyClass`) before comparing so that
  // circular-dependency patterns don't trigger false conflict errors.
  const resolvedOptionType = resolveType(options?.type);
  if (
    resolvedOptionType !== undefined &&
    reflectedType !== undefined &&
    reflectedType !== Object &&
    reflectedType !== Array &&
    resolvedOptionType !== reflectedType
  ) {
    throw new TypeError(
      `@XmlElement: explicit type option "${resolvedOptionType?.name}" conflicts with the` +
      ` declared TypeScript type "${reflectedType?.name}" for property` +
      ` "${String(propertyKey)}". Remove the type option or align it with the property declaration.`
    );
  }
  // Array (array properties) and Object (union types) cannot be meaningfully used
  // as the element coercion target, so fall back to options?.type only.
  if (reflectedType === Array || reflectedType === Object) {
    return options?.type;
  }
  return options?.type ?? reflectedType;
}

/**
 * Decorator to mark a property as an XML element.
 *
 * This decorator registers metadata for marshalling/unmarshalling a class property
 * to/from an XML child element. Supports arrays, custom types, namespaces, and nillable elements.
 *
 * @param name - The XML element name (defaults to property name)
 * @param options - Optional configuration
 * @param options.type - The TypeScript type constructor for the element (required for complex types)
 * @param options.array - Whether the element can occur multiple times (array)
 * @param options.namespace - The XML namespace URI for the element
 * @param options.nillable - Whether the element can be explicitly null (xsi:nil)
 * @param options.allowStringFallback - When `true`, non-coercible values are returned
 *   as their original string rather than producing `NaN` (for `Number`) or `false`
 *   (for `Boolean`).  Use this for union types like `number | "unbounded"` or
 *   `boolean | "auto"` where a non-numeric / non-boolean string is a valid value.
 * @returns A property decorator function
 *
 * @example
 * ```typescript
 * class Person {
 *   @XmlElement('Name')
 *   name?: string;
 *
 *   @XmlElement('Address', { type: Address, array: true })
 *   addresses?: Address[];
 * }
 * ```
 */
export function XmlElement(
  name?: string,
  options?: {
    type?: any;
    array?: boolean;
    namespace?: string;
    nillable?: boolean;
    allowStringFallback?: boolean;
  }
) {
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
          kind: "element",
          type: options?.type,
          isArray: !!options?.array,
          namespace: options?.namespace ?? null,
          nillable: !!options?.nillable,
          allowStringFallback: options?.allowStringFallback,
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
        kind: "element",
        type: resolveElementType(options, target, propertyKeyOrContext),
        isArray: !!options?.array,
        namespace: options?.namespace ?? null,
        nillable: !!options?.nillable,
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
        name: name ?? prop.toString(),
        kind: "element",
        type: resolveElementType(options, target, prop),
        isArray: !!options?.array,
        namespace: options?.namespace ?? null,
        nillable: !!options?.nillable,
        allowStringFallback: options?.allowStringFallback,
      });
    };
  } as any;
}
