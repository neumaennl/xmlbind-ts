import { ClassMeta, Constructor, FieldMeta } from "../types";

const META = new WeakMap<Constructor, ClassMeta>();

/**
 * Ensures that metadata exists for a class constructor, creating it if necessary.
 * This is called by decorators to initialize or retrieve metadata for a class.
 *
 * @param ctor - The class constructor
 * @returns The class metadata, either existing or newly created
 */
export function ensureMeta(ctor: Constructor): ClassMeta {
  let m = META.get(ctor);
  if (!m) {
    m = { ctor, fields: [] };
    META.set(ctor, m);
  }
  return m;
}

/**
 * Retrieves metadata for a class constructor if it exists.
 *
 * @param ctor - The class constructor
 * @returns The class metadata, or undefined if no metadata has been registered
 */
export function getMeta(ctor: Constructor): ClassMeta | undefined {
  return META.get(ctor);
}

/**
 * Returns all registered class metadata.
 * Note: WeakMap isn't directly iterable, so this returns an empty array.
 * This function is kept for API compatibility but has limited functionality.
 *
 * @returns An array of all ClassMeta entries (currently always empty)
 */
export function allMeta(): ClassMeta[] {
  const arr: ClassMeta[] = [];
  // WeakMap isn't easily iterable; keep API minimal.
  return arr;
}

export { META };

/**
 * Collects all field metadata for a class, including inherited fields from base classes.
 * Traverses the prototype chain and merges fields, with derived class fields
 * overriding base class fields that have the same key.
 *
 * @param ctor - The class constructor
 * @returns An array of all field metadata entries for the class and its ancestors
 */
export function getAllFields(ctor: Constructor): FieldMeta[] {
  const ctors: Constructor[] = [];
  // Walk prototype chain to Object
  let current: any = ctor;
  while (current && current.prototype) {
    ctors.push(current);
    const proto = Object.getPrototypeOf(current.prototype);
    if (!proto || !proto.constructor || proto.constructor === Object) break;
    current = proto.constructor;
  }

  // Iterate base -> derived so derived overrides win
  const ordered = ctors.reverse();
  const byKey = new Map<string, FieldMeta>();
  for (const c of ordered) {
    const m = getMeta(c);
    if (!m) continue;
    for (const f of m.fields) {
      byKey.set(f.key, f);
    }
  }
  return Array.from(byKey.values());
}
