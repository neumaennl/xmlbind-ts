import { XMLBuilder } from "fast-xml-parser";
import { getMeta, getAllFields } from "../metadata/MetadataRegistry";
import { serializePrimitive } from "../util/valueCasting";

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
});

function isPrimitiveCtor(fn: any) {
  return fn === String || fn === Number || fn === Boolean || fn === Date;
}

type NsContext = {
  defaultNs?: string;
  // Map from namespace URI to prefix
  uriToPrefix: Map<string, string>;
  // Set of prefixes already declared on root
  declared: Set<string>;
  // Root node to which xmlns declarations are attached
  rootNode: any;
  counter: number;
};

function ensurePrefix(ns: string, ctx: NsContext): string {
  let p = ctx.uriToPrefix.get(ns);
  if (p) return p;
  p = `ns${++ctx.counter}`;
  ctx.uriToPrefix.set(ns, p);
  // declare on root if not already
  if (!ctx.declared.has(p)) {
    ctx.rootNode[`@_xmlns:${p}`] = ns;
    ctx.declared.add(p);
  }
  return p;
}

function qName(
  local: string,
  ns: string | undefined,
  ctx: NsContext,
  isAttribute = false
): string {
  if (!ns) return local;
  // default namespace never applies to attributes; force prefix if attribute
  if (!isAttribute && ctx.defaultNs && ns === ctx.defaultNs) {
    return local;
  }
  const prefix = ensurePrefix(ns, ctx);
  return `${prefix}:${local}`;
}

function elementToXmlValue(val: any, type: any, ctx: NsContext) {
  if (val === null || val === undefined) return null;
  if (isPrimitiveCtor(type) || typeof val !== "object")
    return serializePrimitive(val, type);
  const nestedMeta = getMeta(type);
  if (!nestedMeta) return val;
  const nestedNode: any = {};
  const nestedFields = getAllFields(type);
  for (const nf of nestedFields.filter((ff: any) => ff.kind === "attribute")) {
    const v = val[nf.key];
    if (v !== undefined && v !== null)
      nestedNode[`@_${qName(nf.name, nf.namespace ?? undefined, ctx, true)}`] =
        serializePrimitive(v, nf.type);
  }
  for (const nf of nestedFields.filter((ff: any) => ff.kind === "element")) {
    const v = val[nf.key];
    if (v === undefined) continue;
    const key = qName(nf.name, nf.namespace ?? undefined, ctx, false);
    if (v === null) nestedNode[key] = { "@_xsi:nil": "true" };
    else if (nf.isArray && Array.isArray(v))
      nestedNode[key] = v.map((el: any) => elementToXmlValue(el, nf.type, ctx));
    else nestedNode[key] = elementToXmlValue(v, nf.type, ctx);
  }
  const textF = nestedFields.find((ff: any) => ff.kind === "text");
  if (textF && val[textF.key] !== undefined && val[textF.key] !== null)
    nestedNode["#text"] = String(val[textF.key]);
  return nestedNode;
}

export function marshal(obj: any): string {
  if (!obj) return "";
  const ctor = obj.constructor;
  const meta = getMeta(ctor);
  if (!meta) throw new Error("No XmlRoot metadata for " + ctor.name);

  const rootName = meta.rootName ?? ctor.name;
  const xmlObj: any = {};
  const node: any = {};

  if (meta.namespace) node["@_xmlns"] = meta.namespace;

  const ctx: NsContext = {
    defaultNs: meta.namespace ?? undefined,
    uriToPrefix: new Map<string, string>(),
    declared: new Set<string>(),
    rootNode: node,
    counter: 0,
  };

  // Seed known prefixes from @XmlRoot options
  if (meta.prefixes) {
    for (const [uri, pfx] of Object.entries(meta.prefixes)) {
      ctx.uriToPrefix.set(uri, pfx);
      // pre-declare on root
      node[`@_xmlns:${pfx}`] = uri;
      ctx.declared.add(pfx);
    }
  }

  const fields = getAllFields(ctor);

  for (const f of fields.filter((f: any) => f.kind === "attribute")) {
    const val = obj[f.key];
    if (val === undefined || val === null) continue;
    const key = qName(f.name, f.namespace ?? undefined, ctx, true);
    node[`@_${key}`] = serializePrimitive(val, f.type);
  }

  for (const f of fields.filter((f: any) => f.kind === "element")) {
    const val = obj[f.key];
    if (val === undefined) continue;
    const key = qName(f.name, f.namespace ?? undefined, ctx, false);
    if (val === null) {
      node[key] = { "@_xsi:nil": "true" };
      continue;
    }
    if (f.isArray && Array.isArray(val))
      node[key] = val.map((el: any) => elementToXmlValue(el, f.type, ctx));
    else {
      node[key] = elementToXmlValue(val, f.type, ctx);
      // Merge child class-known prefixes into context for future siblings if not already present
      const childMeta = getMeta(f.type);
      if (childMeta?.prefixes) {
        for (const [uri, pfx] of Object.entries(childMeta.prefixes)) {
          if (!ctx.uriToPrefix.has(uri)) {
            ctx.uriToPrefix.set(uri, pfx);
            if (!ctx.declared.has(pfx)) {
              node[`@_xmlns:${pfx}`] = uri;
              ctx.declared.add(pfx);
            }
          }
        }
      }
    }
  }

  const textField = fields.find((f: any) => f.kind === "text");
  if (textField) {
    const tv = obj[textField.key];
    if (tv !== undefined && tv !== null) node["#text"] = tv.toString();
  }

  xmlObj[rootName] = node;
  return builder.build(xmlObj);
}
