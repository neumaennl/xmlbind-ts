/**
 * The kind of XML binding for a class field.
 * - element: Mapped to an XML child element
 * - attribute: Mapped to an XML attribute
 * - text: Mapped to the text content of an element
 * - anyElement: Wildcard for unbound child elements (xs:any)
 * - anyAttribute: Wildcard for unbound attributes (xs:anyAttribute)
 * - comments: XML comments (<!-- ... -->)
 */
export type FieldKind =
  | "element"
  | "attribute"
  | "text"
  | "anyElement"
  | "anyAttribute"
  | "comments";

/**
 * Metadata describing how a single class field maps to XML.
 * Used internally by decorators and marshalling/unmarshalling logic.
 */
export interface FieldMeta {
  /** The JavaScript property name */
  key: string;
  /** The XML element or attribute name */
  name: string;
  /** The type of XML binding */
  kind: FieldKind;
  /** The TypeScript type constructor for complex types */
  type?: any;
  /** Whether this field represents an array of elements */
  isArray?: boolean;
  /** The XML namespace URI for this field */
  namespace?: string | null;
  /** Whether the element can be explicitly null (xsi:nil) */
  nillable?: boolean;
  // For wildcards, we may later add filter info (e.g., namespaces, processContents)
  // For now, they act as catch-alls without filtering.
}

/**
 * Generic constructor type for creating instances of a class.
 */
export type Constructor<T = any> = new (...args: any[]) => T;

/**
 * Metadata describing how a class maps to XML.
 * Includes root element information and field mappings.
 */
export interface ClassMeta {
  /** The class constructor */
  ctor: Constructor;
  /** The XML root element name (if this is a root element) */
  rootName?: string;
  /** The default XML namespace for the root element */
  namespace?: string | null;
  /** Preferred namespace prefixes (URI -> prefix mapping) */
  prefixes?: Record<string, string> | undefined;
  /** Array of field metadata entries */
  fields: FieldMeta[];
}
