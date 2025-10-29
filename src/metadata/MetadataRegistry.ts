import { ClassMeta, Constructor, FieldMeta } from "../types";

const META = new WeakMap<Constructor, ClassMeta>();

export function ensureMeta(ctor: Constructor): ClassMeta {
  let m = META.get(ctor);
  if (!m) {
    m = { ctor, fields: [] };
    META.set(ctor, m);
  }
  return m;
}

export function getMeta(ctor: Constructor): ClassMeta | undefined {
  return META.get(ctor);
}

export function allMeta(): ClassMeta[] {
  const arr: ClassMeta[] = [];
  // WeakMap isn't easily iterable; keep API minimal.
  return arr;
}

export { META };

/**
 * Collects FieldMeta entries for a class including its ancestors.
 * Derived-class fields override base-class fields with the same key.
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
