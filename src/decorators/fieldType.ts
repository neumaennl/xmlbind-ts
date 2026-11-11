import "reflect-metadata";
import { resolveType } from "../util/typeResolution.js";

/**
 * Resolves the type that a legacy field decorator records: the explicit
 * `options.type` takes precedence; otherwise the type that TypeScript emits
 * for the field's declaration (`design:type`, with `emitDecoratorMetadata`).
 *
 * A design type listed in `ignored` is neither recorded nor compared with
 * `options.type`. TypeScript emits `Object` for unions and `Array` for array
 * fields, which do not describe how the XML text is converted. Lazy type
 * references such as `() => MyClass` are resolved before the comparison.
 *
 * @param decorator - The name of the decorator, such as `"@XmlElement"`, for the error message
 * @param options - The decorator options, with the optional explicit `type`
 * @param target - The prototype that declares the field
 * @param propertyKey - The name of the field
 * @param ignored - The design types that are not used
 * @returns The type to record in the field's metadata, or `undefined` if there is none
 * @throws {TypeError} If `options.type` contradicts the declared type of the field
 *
 * @example
 * ```typescript
 * // For `count?: number` with emitDecoratorMetadata:
 * resolveFieldType("@XmlText", undefined, proto, "count", [Object]); // Number
 * resolveFieldType("@XmlText", { type: Number }, proto, "count", [Object]); // Number
 * resolveFieldType("@XmlText", { type: String }, proto, "count", [Object]); // throws
 * ```
 */
export function resolveFieldType(
  decorator: string,
  options: { type?: any } | undefined,
  target: object,
  propertyKey: string | symbol,
  ignored: readonly unknown[]
): any {
  const reflected = Reflect.getMetadata("design:type", target, propertyKey);
  const designType = ignored.includes(reflected) ? undefined : reflected;
  const optionType = resolveType(options?.type);
  if (optionType !== undefined && designType !== undefined && optionType !== designType) {
    throw new TypeError(
      `${decorator}: explicit type option "${optionType?.name}" conflicts with the` +
      ` declared TypeScript type "${designType?.name}" for property` +
      ` "${String(propertyKey)}". Remove the type option or align it with the property declaration.`
    );
  }
  return options?.type ?? designType;
}
