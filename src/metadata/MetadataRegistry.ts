import { ClassMeta, Constructor } from "../types";

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
