// shared simple types
export type FieldKind = "element" | "attribute" | "text";

export interface FieldMeta {
  key: string;
  name: string;
  kind: FieldKind;
  type?: any;
  isArray?: boolean;
  namespace?: string | null;
  nillable?: boolean;
}

export type Constructor<T = any> = new (...args: any[]) => T;

export interface ClassMeta {
  ctor: Constructor;
  rootName?: string;
  namespace?: string | null;
  fields: FieldMeta[];
}
