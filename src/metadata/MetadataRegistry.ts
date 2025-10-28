import { ClassMeta } from "../types";

const META = new WeakMap<Function, ClassMeta>();

export function ensureMeta(ctor: Function): ClassMeta {
  let m = META.get(ctor);
  if (!m) {
    m = { ctor, fields: [] };
    META.set(ctor, m);
  }
  return m;
}

export function getMeta(ctor: Function): ClassMeta | undefined {
  return META.get(ctor);
}

export function allMeta(): ClassMeta[] {
  const arr: ClassMeta[] = [];
  // WeakMap isn't easily iterable; keep API minimal.
  return arr;
}

export { META };
