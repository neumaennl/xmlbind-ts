import { ensureMeta } from "../metadata/MetadataRegistry";

export function XmlElement(
  name?: string,
  options?: {
    type?: any;
    array?: boolean;
    namespace?: string;
    nillable?: boolean;
  },
) {
  return function (contextOrTarget: any, propertyKey?: string | symbol) {
    if (typeof propertyKey === "string" || typeof propertyKey === "symbol") {
      const target = contextOrTarget as any;
      const ctor = target.constructor;
      const m = ensureMeta(ctor);
      m.fields.push({
        key: propertyKey.toString(),
        name: name ?? propertyKey.toString(),
        kind: "element",
        type: options?.type,
        isArray: !!options?.array,
        namespace: options?.namespace ?? null,
        nillable: !!options?.nillable,
      });
      return;
    }
    return function (target: any, prop: string | symbol) {
      const ctor = target.constructor;
      const m = ensureMeta(ctor);
      m.fields.push({
        key: prop.toString(),
        name: name ?? prop.toString(),
        kind: "element",
        type: options?.type,
        isArray: !!options?.array,
        namespace: options?.namespace ?? null,
        nillable: !!options?.nillable,
      });
    };
  } as any;
}
