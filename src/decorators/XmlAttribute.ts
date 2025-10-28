import { ensureMeta } from "../metadata/MetadataRegistry";

export function XmlAttribute(name?: string, options?: { namespace?: string }) {
  return function (contextOrTarget: any, propertyKey?: string | symbol) {
    if (typeof propertyKey === "string" || typeof propertyKey === "symbol") {
      const target = contextOrTarget as any;
      const ctor = target.constructor;
      const m = ensureMeta(ctor);
      m.fields.push({
        key: propertyKey.toString(),
        name: name ?? propertyKey.toString(),
        kind: "attribute",
        namespace: options?.namespace ?? null,
      });
      return;
    }
    return function (target: any, prop: string | symbol) {
      const ctor = target.constructor;
      const m = ensureMeta(ctor);
      m.fields.push({
        key: prop.toString(),
        name: name ?? prop.toString(),
        kind: "attribute",
        namespace: options?.namespace ?? null,
      });
    };
  } as any;
}
