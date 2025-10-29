import { ensureMeta } from "../metadata/MetadataRegistry";

export function XmlRoot(
  name?: string,
  options?: { namespace?: string; prefixes?: Record<string, string> }
) {
  return function (contextOrCtor: any) {
    if (typeof contextOrCtor === "function") {
      const ctor = contextOrCtor as any;
      const m = ensureMeta(ctor);
      m.rootName = name ?? ctor.name;
      m.namespace = options?.namespace ?? null;
      m.prefixes = options?.prefixes;
      return;
    }
    return function (ctor: any) {
      const m = ensureMeta(ctor);
      m.rootName = name ?? ctor.name;
      m.namespace = options?.namespace ?? null;
      m.prefixes = options?.prefixes;
    };
  } as any;
}
