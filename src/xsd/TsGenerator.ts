import { parseXsd, getSchemaRoot } from "./XsdParser";
import type { Element as XmldomElement } from "@xmldom/xmldom";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

function typeMapping(xsdType: string) {
  if (!xsdType) return "string";
  const local = xsdType.includes(":") ? xsdType.split(":")[1] : xsdType;
  switch (local) {
    case "string":
      return "String";
    case "boolean":
      return "Boolean";
    case "int":
    case "integer":
    case "long":
    case "short":
    case "byte":
    case "decimal":
      return "Number";
    case "date":
    case "dateTime":
      return "Date";
    default:
      return local; // assume complex type
  }
}

export function generateFromXsd(xsdText: string, outDir: string) {
  const doc = parseXsd(xsdText);
  const schema = getSchemaRoot(doc);
  if (!schema) throw new Error("No schema");
  const targetNs = schema.getAttribute("targetNamespace") ?? undefined;

  const ctElements: XmldomElement[] = Array.from(
    schema.getElementsByTagName("xsd:complexType")
  ).concat(Array.from(schema.getElementsByTagName("complexType")));
  const complexTypesMap = new Map<string, XmldomElement>();
  for (const ct of ctElements) {
    const name = ct.getAttribute("name");
    if (name) complexTypesMap.set(name, ct);
  }

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  for (const [name, ct] of complexTypesMap.entries()) {
    const className = name;
    const lines: string[] = [];
    lines.push(
      "import { XmlRoot, XmlElement, XmlAttribute, XmlText } from '@neumaennl/xmlbind-ts';"
    );
    lines.push("");
    lines.push(
      `@XmlRoot('${name}'${targetNs ? `, { namespace: '${targetNs}' }` : ""})`
    );
    lines.push(`export class ${className} {`);

    // attributes
    const attrs: XmldomElement[] = Array.from(
      ct.getElementsByTagName("xsd:attribute")
    ).concat(Array.from(ct.getElementsByTagName("attribute")));
    for (const a of attrs) {
      const an = a.getAttribute("name")!;
      const at = a.getAttribute("type") ?? undefined;
      const tsType = typeMapping(at || "any");
      lines.push(`  @XmlAttribute('${an}')`);
      lines.push(`  ${an}?: ${tsType};`);
      lines.push("");
    }

    // sequences
    const seqs: XmldomElement[] = Array.from(
      ct.getElementsByTagName("xsd:sequence")
    ).concat(Array.from(ct.getElementsByTagName("sequence")));
    for (const seq of seqs) {
      const elems: XmldomElement[] = Array.from(
        seq.getElementsByTagName("xsd:element")
      ).concat(Array.from(seq.getElementsByTagName("element")));
      for (const e of elems) {
        const en = e.getAttribute("name")!;
        const et = e.getAttribute("type") ?? undefined;
        const max = e.getAttribute("maxOccurs") ?? "1";
        const tsType = typeMapping(et || "any");
        const isArray = max === "unbounded" || Number(max) > 1;
        lines.push(
          `  @XmlElement('${en}', { type: ${tsType}${
            isArray ? ", array: true" : ""
          } })`
        );
        lines.push(
          `  ${en}${isArray ? "?: " + tsType + "[];" : "?: " + tsType + ";"}`
        );
        lines.push("");
      }
    }

    // choices
    const choices: XmldomElement[] = Array.from(
      ct.getElementsByTagName("xsd:choice")
    ).concat(Array.from(ct.getElementsByTagName("choice")));
    for (const choice of choices) {
      const elems: XmldomElement[] = Array.from(
        choice.getElementsByTagName("xsd:element")
      ).concat(Array.from(choice.getElementsByTagName("element")));
      for (const e of elems) {
        const en = e.getAttribute("name")!;
        const et = e.getAttribute("type") ?? undefined;
        const tsType = typeMapping(et || "any");
        lines.push(`  @XmlElement('${en}', { type: ${tsType} })`);
        lines.push(`  ${en}?: ${tsType};`);
        lines.push("");
      }
    }

    lines.push("}");

    const code = lines.join("\n");
    const file = join(outDir, className + ".ts");
    writeFileSync(file, code, "utf8");
    console.log("Wrote", file);
  }
}
