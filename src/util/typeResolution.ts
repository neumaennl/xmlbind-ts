/**
 * Type definition for lazy type references.
 * Can be either a constructor directly or a function that returns a constructor.
 * The function form allows deferring type resolution to avoid circular dependency issues.
 */
export type TypeReference<T = any> = (new (...args: any[]) => T) | (() => new (...args: any[]) => T);

/**
 * Resolves a type reference to its actual constructor.
 * Handles both direct constructors and lazy type references (functions that return constructors).
 *
 * This is useful for breaking circular dependencies between classes, where the type
 * might not be available at decorator evaluation time but will be available at runtime.
 *
 * @param typeRef - Either a constructor or a function that returns a constructor
 * @returns The resolved constructor, or undefined if typeRef is falsy
 *
 * @example
 * ```typescript
 * // Direct constructor
 * resolveType(MyClass) // returns MyClass
 *
 * // Lazy reference (for circular dependencies)
 * resolveType(() => MyClass) // returns MyClass
 * ```
 */
export function resolveType<T>(typeRef: TypeReference<T> | undefined | null): (new (...args: any[]) => T) | undefined {
  if (!typeRef) {
    return undefined;
  }

  if (typeof typeRef !== "function") {
    return undefined;
  }

  // Try calling it as a factory function first.
  // Arrow functions (lazy references) will return the constructor.
  // Class constructors will throw or return undefined when called without 'new'.
  try {
    const result = (typeRef as () => new (...args: any[]) => T)();
    // If result is a valid constructor (function with prototype), return it
    if (typeof result === "function" && result.prototype) {
      return result;
    }
  } catch {
    // Calling failed, it's likely a class constructor
  }

  // If calling didn't work, treat it as a direct constructor
  return typeRef as new (...args: any[]) => T;
}
