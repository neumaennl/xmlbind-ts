import { getMeta, getAllFields } from "../metadata/MetadataRegistry.js";
import type { ClassMeta, FieldMeta } from "../types.js";
import { serializePrimitive } from "../util/valueCasting.js";
import { resolveType } from "../util/typeResolution.js";
import { isNamespaceDeclaration } from "../util/namespaceUtils.js";
import { isPrimitiveCtor } from "./types.js";
import { hasPositionedComments, groupCommentsByPosition } from "./commentUtils.js";
import { sortFieldsByElementOrder } from "./elementOrderUtils.js";
import { qName, type NsContext } from "./marshalContext.js";
import {
  comment,
  declaration,
  element,
  fromKeyed,
  text,
  writeXml,
  type XmlAttributes,
  type XmlEntry,
} from "./xmlTree.js";

/** The attributes and child entries of an element. */
interface ElementContent {
  attributes: XmlAttributes;
  children: XmlEntry[];
}

/**
 * Writes the attribute fields of an object.
 * @param attributes - The attributes to add to
 * @param obj - The source object
 * @param fields - All fields of the object's type
 * @param ctx - Namespace context
 */
function writeAttributes(
  attributes: XmlAttributes,
  obj: any,
  fields: FieldMeta[],
  ctx: NsContext
): void {
  for (const f of fields.filter((f) => f.kind === "attribute")) {
    const val = obj[f.key];
    if (val === undefined || val === null) continue;
    const name = qName(f.name, f.namespace ?? undefined, ctx, true);
    attributes[name] = serializePrimitive(val, resolveType(f.type));
  }
}

/**
 * Creates the entries of one occurrence of an element.
 * @param name - The qualified name of the element
 * @param val - The value: a primitive, an object of a class with metadata, or content in the parser's keyed format
 * @param type - The resolved type of the field
 * @param ctx - Namespace context
 * @returns The element entries
 */
function valueEntries(
  name: string,
  val: unknown,
  type: any,
  ctx: NsContext
): XmlEntry[] {
  if (val === null || val === undefined) return [element(name)];
  if (isPrimitiveCtor(type) || typeof val !== "object")
    return [element(name, [text(serializePrimitive(val, type))])];
  if (!getMeta(type)) return fromKeyed(name, val);
  const content = objectContent(val, type, ctx, false);
  return [element(name, content.children, content.attributes)];
}

/**
 * Creates the entries of an element field: one element per array item,
 * and an element with `xsi:nil="true"` for `null`.
 * @param f - The field
 * @param val - The field's value, not `undefined`
 * @param ctx - Namespace context
 * @param isRoot - Whether the field belongs to the root object
 * @returns The element entries
 */
function fieldEntries(
  f: FieldMeta,
  val: unknown,
  ctx: NsContext,
  isRoot: boolean
): XmlEntry[] {
  const name = qName(f.name, f.namespace ?? undefined, ctx, false);
  if (val === null) return [element(name, [], { "xsi:nil": "true" })];
  const type = resolveType(f.type);
  if (f.isArray && Array.isArray(val))
    return val.flatMap((item) => valueEntries(name, item, type, ctx));
  const entries = valueEntries(name, val, type, ctx);
  if (isRoot) mergeChildPrefixes(ctx, type);
  return entries;
}

/**
 * Writes the element fields of an object in the order of `_elementOrder`,
 * with the comments of `_comments`: comments with a position between the
 * fields, plain comment texts after them.
 * @param children - The child entries to add to
 * @param obj - The source object
 * @param fields - All fields of the object's type
 * @param ctx - Namespace context
 * @param isRoot - Whether the object is the root object
 * @throws {Error} If a comment contains `--` or ends with `-`
 */
function writeElements(
  children: XmlEntry[],
  obj: any,
  fields: FieldMeta[],
  ctx: NsContext,
  isRoot: boolean
): void {
  const elementFields = sortFieldsByElementOrder(
    fields.filter((f) => f.kind === "element"),
    obj._elementOrder
  );
  const commentsData = obj._comments;
  const positioned = hasPositionedComments(commentsData);
  const commentsByPosition = positioned
    ? groupCommentsByPosition(commentsData)
    : new Map<number, string[]>();

  for (let i = 0; i <= elementFields.length; i++) {
    for (const c of commentsByPosition.get(i) ?? []) children.push(comment(String(c)));
    if (i === elementFields.length) break;
    const f = elementFields[i];
    const val = obj[f.key];
    if (val !== undefined) children.push(...fieldEntries(f, val, ctx, isRoot));
  }

  if (!positioned && Array.isArray(commentsData)) {
    for (const c of commentsData) children.push(comment(String(c)));
  }
}

/**
 * Writes the wildcard attributes and elements of an object, and its text.
 * @param content - The element content to add to
 * @param obj - The source object
 * @param fields - All fields of the object's type
 * @throws {Error} If a wildcard element is named with a key that starts with `@_` or is `#text`
 */
function writeWildcardsAndText(
  content: ElementContent,
  obj: any,
  fields: FieldMeta[]
): void {
  const anyAttrField = fields.find((f) => f.kind === "anyAttribute");
  const map = anyAttrField && obj[anyAttrField.key];
  if (map && typeof map === "object") {
    for (const [k, v] of Object.entries(map)) {
      if (!isNamespaceDeclaration(k)) content.attributes[k] = String(v);
    }
  }

  const anyElemField = fields.find((f) => f.kind === "anyElement");
  const items = anyElemField && obj[anyElemField.key];
  if (Array.isArray(items)) {
    for (const item of items) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) continue;
      for (const [k, v] of Object.entries(item)) content.children.push(...fromKeyed(k, v));
    }
  }

  const textField = fields.find((f) => f.kind === "text");
  const tv = textField && obj[textField.key];
  if (tv !== undefined && tv !== null) content.children.push(text(String(tv)));
}

/**
 * Creates the attributes and child entries of an object of a class with
 * metadata: attributes, then elements with comments, wildcards and text.
 * @param obj - The source object
 * @param type - The class of the object
 * @param ctx - Namespace context
 * @param isRoot - Whether the object is the root object, whose attributes are those of the namespace context
 * @returns The element content
 * @throws {Error} If a comment contains `--` or ends with `-`
 * @throws {Error} If a wildcard element is named with a key that starts with `@_` or is `#text`
 */
function objectContent(
  obj: any,
  type: any,
  ctx: NsContext,
  isRoot: boolean
): ElementContent {
  const content: ElementContent = {
    attributes: isRoot ? ctx.rootAttributes : {},
    children: [],
  };
  const fields = getAllFields(type);
  writeAttributes(content.attributes, obj, fields, ctx);
  writeElements(content.children, obj, fields, ctx, isRoot);
  writeWildcardsAndText(content, obj, fields);
  return content;
}

/**
 * Initializes the namespace context for marshalling.
 * Uses `obj._namespacePrefixes` (prefix → URI) if set on the object; otherwise falls back
 * to `meta.prefixes` (URI → prefix) from the decorator.
 * @param meta - The root metadata
 * @param obj - The source object (may have `_namespacePrefixes`)
 * @returns The initialized namespace context
 */
function initializeNsContext(meta: ClassMeta, obj: any): NsContext {
  const nsPrefixes = obj._namespacePrefixes as
    | Record<string, string>
    | undefined;
  const rootAttributes: XmlAttributes = {};

  const ctx: NsContext = {
    defaultNs: nsPrefixes !== undefined
      ? nsPrefixes[""] || undefined
      : meta.namespace ?? undefined,
    uriToPrefix: new Map<string, string>(),
    declared: new Set<string>(),
    rootAttributes,
    counter: 0,
    hasExplicitPrefixes: nsPrefixes !== undefined,
  };

  if (nsPrefixes) {
    // Use the source document's namespace declarations (prefix → URI).
    for (const [pfx, uri] of Object.entries(nsPrefixes)) {
      if (!pfx) {
        rootAttributes["xmlns"] = uri;
        continue;
      }
      ctx.uriToPrefix.set(uri, pfx);
      rootAttributes[`xmlns:${pfx}`] = uri;
      ctx.declared.add(pfx);
    }
    return ctx;
  }

  if (meta.namespace) rootAttributes["xmlns"] = meta.namespace;
  if (meta.prefixes) {
    // Fall back to decorator-defined prefixes (URI → prefix)
    for (const [uri, pfx] of Object.entries(meta.prefixes)) {
      ctx.uriToPrefix.set(uri, String(pfx));
      rootAttributes[`xmlns:${pfx}`] = uri;
      ctx.declared.add(String(pfx));
    }
  }
  return ctx;
}

/**
 * Merges child class prefixes into namespace context.
 * Skipped when the root object supplied its own `_namespacePrefixes`, because in
 * that case the caller controls exactly which namespace declarations appear in the
 * output and adding extras would make roundtrips inconsistent.
 * @param ctx - Namespace context
 * @param resolvedFType - Resolved field type
 */
function mergeChildPrefixes(ctx: NsContext, resolvedFType: any): void {
  if (ctx.hasExplicitPrefixes || !resolvedFType) return;
  const childMeta = getMeta(resolvedFType);
  if (!childMeta?.prefixes) return;
  for (const [uri, pfx] of Object.entries(childMeta.prefixes)) {
    const prefix = String(pfx);
    if (ctx.uriToPrefix.has(uri)) continue;
    ctx.uriToPrefix.set(uri, prefix);
    if (!ctx.declared.has(prefix)) {
      ctx.rootAttributes[`xmlns:${prefix}`] = uri;
      ctx.declared.add(prefix);
    }
  }
}

/**
 * Creates the entries before the root element: the XML declaration, if the
 * source had one, and the comments before the root element.
 * @param obj - The root object
 * @returns The entries
 * @throws {Error} If a comment contains `--` or ends with `-`
 */
function prologEntries(obj: any): XmlEntry[] {
  const entries: XmlEntry[] = [];
  if (obj._hasXmlDeclaration) entries.push(declaration());
  if (Array.isArray(obj._documentComments)) {
    for (const c of obj._documentComments) entries.push(comment(String(c)));
  }
  return entries;
}

/**
 * Marshals a JavaScript object to an XML string.
 *
 * The object must have @XmlRoot metadata defined. All decorated properties
 * (@XmlElement, @XmlAttribute, @XmlText, etc.) will be serialized to XML.
 * Handles namespaces, prefixes, arrays, nested objects, wildcard elements/attributes
 * and the comments and order stored by `unmarshal()`.
 *
 * @param obj - The object to marshal (must have @XmlRoot decorator)
 * @returns The XML string representation
 * @throws {Error} If the object has no XmlRoot metadata
 * @throws {Error} If a comment contains `--` or ends with `-`, which XML cannot represent
 * @throws {Error} If a wildcard element is named with a key that starts with `@_` or is `#text`
 */
export function marshal(obj: any): string {
  if (!obj) return "";
  const ctor = obj.constructor;
  const meta = getMeta(ctor);
  if (!meta) throw new Error("No XmlRoot metadata for " + ctor.name);

  const ctx = initializeNsContext(meta, obj);
  const content = objectContent(obj, ctor, ctx, true);
  const rootName = qName(
    meta.rootName ?? ctor.name,
    meta.namespace ?? undefined,
    ctx,
    false
  );
  return writeXml([
    ...prologEntries(obj),
    element(rootName, content.children, content.attributes),
  ]);
}
