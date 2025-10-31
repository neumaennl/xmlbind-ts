// shared simple types
export type FieldKind =
  | "element"
  | "attribute"
  | "text"
  | "anyElement"
  | "anyAttribute";

export interface FieldMeta {
  key: string;
  name: string;
  kind: FieldKind;
  type?: any;
  isArray?: boolean;
  namespace?: string | null;
  nillable?: boolean;
  // For wildcards, we may later add filter info (e.g., namespaces, processContents)
  // For now, they act as catch-alls without filtering.
}

export type Constructor<T = any> = new (...args: any[]) => T;

export interface ClassMeta {
  ctor: Constructor;
  rootName?: string;
  namespace?: string | null;
  prefixes?: Record<string, string> | undefined;
  fields: FieldMeta[];
}
