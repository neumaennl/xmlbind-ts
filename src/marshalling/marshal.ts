import { XMLBuilder } from "fast-xml-parser";
import { getMeta } from "../metadata/MetadataRegistry";
import { serializePrimitive } from "../util/valueCasting";

const builder = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
});

function isPrimitiveCtor(fn: any) {
  return fn === String || fn === Number || fn === Boolean || fn === Date;
}

function elementToXmlValue(val: any, type?: any) {
  if (val === null || val === undefined) return null;
  if (isPrimitiveCtor(type) || typeof val !== "object")
    return serializePrimitive(val, type);
  const nestedMeta = getMeta(type);
  if (!nestedMeta) return val;
  const nestedNode: any = {};
  for (const nf of nestedMeta.fields.filter(
    (ff: any) => ff.kind === "attribute",
  )) {
    const v = val[nf.key];
    if (v !== undefined && v !== null)
      nestedNode[`@_${nf.name}`] = serializePrimitive(v, nf.type);
  }
  for (const nf of nestedMeta.fields.filter(
    (ff: any) => ff.kind === "element",
  )) {
    const v = val[nf.key];
    if (v === undefined) continue;
    if (v === null) nestedNode[nf.name] = { "@_xsi:nil": "true" };
    else if (nf.isArray && Array.isArray(v))
      nestedNode[nf.name] = v.map((el: any) => elementToXmlValue(el, nf.type));
    else nestedNode[nf.name] = elementToXmlValue(v, nf.type);
  }
  const textF = nestedMeta.fields.find((ff: any) => ff.kind === "text");
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

  for (const f of meta.fields.filter((f: any) => f.kind === "attribute")) {
    const val = obj[f.key];
    if (val === undefined || val === null) continue;
    node[`@_${f.name}`] = serializePrimitive(val, f.type);
  }

  for (const f of meta.fields.filter((f: any) => f.kind === "element")) {
    const val = obj[f.key];
    if (val === undefined) continue;
    if (val === null) {
      node[f.name] = { "@_xsi:nil": "true" };
      continue;
    }
    if (f.isArray && Array.isArray(val))
      node[f.name] = val.map((el: any) => elementToXmlValue(el, f.type));
    else node[f.name] = elementToXmlValue(val, f.type);
  }

  const textField = meta.fields.find((f: any) => f.kind === "text");
  if (textField) {
    const tv = obj[textField.key];
    if (tv !== undefined && tv !== null) node["#text"] = tv.toString();
  }

  xmlObj[rootName] = node;
  return builder.build(xmlObj);
}
