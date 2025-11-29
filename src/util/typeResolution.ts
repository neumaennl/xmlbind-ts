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

  // Check if it's a function that returns a constructor (lazy reference)
  // We need to distinguish between a constructor function and a factory function.
  // A constructor function typically has a prototype with a constructor property pointing to itself,
  // while a factory function (arrow function or regular function returning a class) does not.
  if (typeof typeRef === "function") {
    // Check if it's a class constructor
    // Class constructors have a prototype object with a constructor property
    // Arrow functions and regular functions that return a constructor don't have meaningful prototypes
    const proto = typeRef.prototype;
    
    // If it has a proper prototype with constructor, it's likely a class constructor
    if (proto && proto.constructor === typeRef) {
      return typeRef as new (...args: any[]) => T;
    }
    
    // Otherwise, try to call it as a factory function
    try {
      const result = (typeRef as () => new (...args: any[]) => T)();
      if (typeof result === "function" && result.prototype) {
        return result;
      }
    } catch {
      // If calling it throws, it was probably a constructor, not a factory
    }
    
    // Fall back to treating it as a constructor
    return typeRef as new (...args: any[]) => T;
  }

  return undefined;
}
