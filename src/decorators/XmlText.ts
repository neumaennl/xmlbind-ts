import { ensureMeta } from "../metadata/MetadataRegistry";

export function XmlText() {
  return function (contextOrTarget: any, propertyKey?: string | symbol) {
    if (typeof propertyKey === "string" || typeof propertyKey === "symbol") {
      const target = contextOrTarget as any;
      const ctor = target.constructor;
      const m = ensureMeta(ctor);
      m.fields.push({
        key: propertyKey.toString(),
        name: propertyKey.toString(),
        kind: "text",
        namespace: null,
      });
      return;
    }
    return function (target: any, prop: string | symbol) {
      const ctor = target.constructor;
      const m = ensureMeta(ctor);
      m.fields.push({
        key: prop.toString(),
        name: prop.toString(),
        kind: "text",
        namespace: null,
      });
    };
  } as any;
}
