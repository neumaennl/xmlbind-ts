import { ensureMeta } from "../metadata/MetadataRegistry";

export function XmlRoot(name?: string, options?: { namespace?: string }) {
  return function (contextOrCtor: any) {
    if (typeof contextOrCtor === "function") {
      const ctor = contextOrCtor as Function;
      const m = ensureMeta(ctor);
      m.rootName = name ?? ctor.name;
      m.namespace = options?.namespace ?? null;
      return;
    }
    return function (ctor: Function) {
      const m = ensureMeta(ctor);
      m.rootName = name ?? ctor.name;
      m.namespace = options?.namespace ?? null;
    };
  } as any;
}
