import { parseXsd, getSchemaRoot } from "./XsdParser";
import type { Element as XmldomElement } from "@xmldom/xmldom";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

function localName(qname?: string | null): string | undefined {
  if (!qname) return undefined;
  return qname.includes(":") ? qname.split(":").pop()! : qname;
}

function typeMapping(xsdType?: string | null) {
  if (!xsdType) return "String";
  const local = localName(xsdType)!;
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
    case "anyType":
      return "any";
    default:
      return local; // assume complex or user type
  }
}

function isBuiltinType(xsdType?: string | null): boolean {
  if (!xsdType) return false;
  const l = localName(xsdType);
  return (
    l === "string" ||
    l === "boolean" ||
    l === "int" ||
    l === "integer" ||
    l === "long" ||
    l === "short" ||
    l === "byte" ||
    l === "decimal" ||
    l === "date" ||
    l === "dateTime" ||
    l === "anyType"
  );
}

function directChildren(el: XmldomElement, names: string[]): XmldomElement[] {
  const out: XmldomElement[] = [];
  const set = new Set(names);
  for (let i = 0; i < (el.childNodes?.length ?? 0); i++) {
    const n = el.childNodes[i] as any;
    if (!n || n.nodeType !== 1) continue; // ELEMENT_NODE
    const nn = (n.nodeName as string) || "";
    const ln = nn.includes(":") ? nn.split(":").pop()! : nn;
    if (set.has(nn) || set.has(ln)) out.push(n as XmldomElement);
  }
  return out;
}

function extractEnumValues(restriction: XmldomElement): string[] {
  const values: string[] = [];
  const enums = Array.from(
    restriction.getElementsByTagName("xsd:enumeration")
  ).concat(Array.from(restriction.getElementsByTagName("enumeration")));

  for (const enumEl of enums) {
    const value = (enumEl as XmldomElement).getAttribute("value");
    if (value) values.push(value);
  }
  return values;
}

function generateEnumCode(name: string, values: string[]): string {
  const lines: string[] = [];
  lines.push(`export enum ${name} {`);

  for (const value of values) {
    // Sanitize enum key: replace invalid characters with underscore
    let key = value.replace(/[^A-Za-z0-9_]/g, "_");
    // Ensure key doesn't start with a number
    if (/^[0-9]/.test(key)) {
      key = "_" + key;
    }
    lines.push(`  ${key} = "${value}",`);
  }

  lines.push("}");
  return lines.join("\n");
}

export function generateFromXsd(xsdText: string, outDir: string) {
  const doc = parseXsd(xsdText);
  const schema = getSchemaRoot(doc);
  if (!schema) throw new Error("No schema");
  const targetNs = schema.getAttribute("targetNamespace") ?? undefined;
  const elementFormDefault =
    schema.getAttribute("elementFormDefault") || "unqualified";
  const attributeFormDefault =
    schema.getAttribute("attributeFormDefault") || "unqualified";

  // Index top-level definitions
  const complexTypesMap = new Map<string, XmldomElement>();
  for (const ct of directChildren(schema as any, [
    "xsd:complexType",
    "complexType",
  ])) {
    const name = ct.getAttribute("name");
    if (name) complexTypesMap.set(name, ct);
  }
  const simpleTypesMap = new Map<string, XmldomElement>();
  const enumTypesMap = new Map<string, string[]>();
  for (const st of directChildren(schema as any, [
    "xsd:simpleType",
    "simpleType",
  ])) {
    const name = st.getAttribute("name");
    if (name) {
      simpleTypesMap.set(name, st);
      // Check if it's an enumeration
      const restriction =
        st.getElementsByTagName("xsd:restriction")[0] ||
        st.getElementsByTagName("restriction")[0];
      if (restriction) {
        const enumValues = extractEnumValues(restriction as XmldomElement);
        if (enumValues.length > 0) {
          enumTypesMap.set(name, enumValues);
        }
      }
    }
  }
  const topLevelElements: XmldomElement[] = directChildren(schema as any, [
    "xsd:element",
    "element",
  ]);

  // Collect schema-declared prefixes (URI -> prefix), excluding default xmlns
  const schemaPrefixes = new Map<string, string>();
  const attrs: any = (schema as any).attributes;
  if (attrs && attrs.length) {
    for (let i = 0; i < attrs.length; i++) {
      const a = attrs[i];
      const name: string = a.nodeName || a.name;
      const value: string = a.nodeValue || a.value;
      if (name && name.startsWith("xmlns:") && value) {
        const pfx = name.substring("xmlns:".length);
        schemaPrefixes.set(value, pfx);
      }
    }
  }

  // Process xsd:import declarations
  // For now, we'll just track imported namespaces and add them to the prefix map
  // Full import resolution would require loading external schemas
  const importedNamespaces = new Set<string>();
  for (const imp of directChildren(schema as any, ["xsd:import", "import"])) {
    const ns = imp.getAttribute("namespace");
    if (ns) {
      importedNamespaces.add(ns);
      // If not already in schemaPrefixes, add a generated prefix
      if (!schemaPrefixes.has(ns)) {
        const prefix = `imp${importedNamespaces.size}`;
        schemaPrefixes.set(ns, prefix);
      }
    }
  }

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  type GenUnit = { lines: string[]; deps: Set<string> };
  const generated = new Map<string, GenUnit>();
  const generatedEnums = new Map<string, string>();

  // Generate enum types first
  for (const [name, values] of enumTypesMap.entries()) {
    const enumCode = generateEnumCode(name, values);
    generatedEnums.set(name, enumCode);
  }

  function emitHeader(lines: string[]) {
    lines.push(
      "import { XmlRoot, XmlElement, XmlAttribute, XmlText } from '@neumaennl/xmlbind-ts';"
    );
  }

  function elementNamespaceFor(
    e: XmldomElement,
    isTopLevel: boolean
  ): string | undefined {
    if (isTopLevel) return targetNs;
    const form = e.getAttribute("form");
    if (form === "qualified") return targetNs;
    if (form === "unqualified") return undefined;
    return elementFormDefault === "qualified" ? targetNs : undefined;
  }

  function attributeNamespaceFor(a: XmldomElement): string | undefined {
    const form = a.getAttribute("form");
    if (form === "qualified") return targetNs;
    if (form === "unqualified") return undefined;
    return attributeFormDefault === "qualified" ? targetNs : undefined;
  }

  function emitAttrs(targetEl: XmldomElement, lines: string[]) {
    const attrs: XmldomElement[] = Array.from(
      targetEl.getElementsByTagName("xsd:attribute")
    ).concat(Array.from(targetEl.getElementsByTagName("attribute")));
    for (const a of attrs) {
      if ((a.parentNode as any) !== targetEl) continue; // only direct in this context
      const an = a.getAttribute("name");
      if (!an) continue;
      const at = a.getAttribute("type");
      const tsType = typeMapping(at || undefined);
      const ans = attributeNamespaceFor(a);
      lines.push(
        ans
          ? `  @XmlAttribute('${an}', { namespace: '${ans}' })`
          : `  @XmlAttribute('${an}')`
      );
      lines.push(`  ${an}?: ${tsType};`);
      lines.push("");
    }
  }

  function ensureClass(
    name: string,
    el: XmldomElement,
    xmlName?: string
  ): GenUnit {
    if (generated.has(name)) return generated.get(name)!;
    const unit: GenUnit = { lines: [], deps: new Set() };
    generated.set(name, unit);

    const lines = unit.lines;
    emitHeader(lines);
    lines.push("");

    // Use xmlName for @XmlRoot if provided, otherwise use name
    const rootName = xmlName ?? name;

    // Determine if complexContent/simpleContent/mixed
    const mixed = el.getAttribute("mixed") === "true";
    const complexContent =
      el.getElementsByTagName("xsd:complexContent")[0] ||
      el.getElementsByTagName("complexContent")[0];
    const simpleContent =
      el.getElementsByTagName("xsd:simpleContent")[0] ||
      el.getElementsByTagName("simpleContent")[0];

    let extendsBase: string | undefined;

    const prefixObj = schemaPrefixes.size
      ? `, prefixes: { ${Array.from(schemaPrefixes.entries())
          .map(([uri, p]) => `'${uri}': '${p}'`)
          .join(", ")} }`
      : "";
    lines.push(
      `@XmlRoot('${rootName}'${
        targetNs ? `, { namespace: '${targetNs}'${prefixObj} }` : ""
      })`
    );

    // Handle simpleContent: text + attributes
    if (simpleContent) {
      const ext =
        (simpleContent as any).getElementsByTagName("xsd:extension")[0] ||
        (simpleContent as any).getElementsByTagName("extension")[0] ||
        (simpleContent as any).getElementsByTagName("xsd:restriction")[0] ||
        (simpleContent as any).getElementsByTagName("restriction")[0];
      let textTs = "String";
      if (ext) {
        const base = (ext as XmldomElement).getAttribute("base");
        if (base) textTs = typeMapping(base);
      }
      lines.push(`export class ${name} {`);
      lines.push(`  @XmlText()`);
      lines.push(`  value?: ${textTs};`);
      lines.push("");
      if (ext) emitAttrs(ext as any, lines);
      lines.push("}");
      return unit;
    }

    // Handle complexContent extension/restriction
    if (complexContent) {
      const ext =
        (complexContent as any).getElementsByTagName("xsd:extension")[0] ||
        (complexContent as any).getElementsByTagName("extension")[0];
      const rest =
        (complexContent as any).getElementsByTagName("xsd:restriction")[0] ||
        (complexContent as any).getElementsByTagName("restriction")[0];
      if (ext) {
        const base = (ext as XmldomElement).getAttribute("base");
        const baseLocal = localName(base);
        if (baseLocal && !isBuiltinType(base)) {
          extendsBase = baseLocal;
          unit.deps.add(baseLocal);
        }
        lines.push(
          `export class ${name}${
            extendsBase ? ` extends ${extendsBase}` : ""
          } {`
        );
        // attributes directly under extension
        emitAttrs(ext as any, lines);
        // sequences/choices under extension
        emitElements(ext as any, lines, unit);
        if (mixed) {
          lines.push(`  @XmlText()`);
          lines.push(`  value?: String;`);
          lines.push("");
        }
        lines.push("}");
        return unit;
      } else if (rest) {
        // For restriction, we don't model base constraints; emit available attrs/elements
        lines.push(`export class ${name} {`);
        emitAttrs(rest as any, lines);
        emitElements(rest as any, lines, unit);
        if (mixed) {
          lines.push(`  @XmlText()`);
          lines.push(`  value?: String;`);
          lines.push("");
        }
        lines.push("}");
        return unit;
      }
    }

    // Default: complexType with sequence/choice/attributes
    lines.push(`export class ${name} {`);
    emitAttrs(el, lines);
    emitElements(el, lines, unit);
    if (mixed) {
      lines.push(`  @XmlText()`);
      lines.push(`  value?: String;`);
      lines.push("");
    }
    lines.push("}");
    return unit;
  }

  function emitElements(ctx: XmldomElement, lines: string[], unit: GenUnit) {
    // sequences
    const seqs: XmldomElement[] = Array.from(
      ctx.getElementsByTagName("xsd:sequence")
    ).concat(Array.from(ctx.getElementsByTagName("sequence")));
    for (const seq of seqs) {
      if ((seq.parentNode as any) !== ctx) continue;
      const elems: XmldomElement[] = Array.from(
        seq.getElementsByTagName("xsd:element")
      ).concat(Array.from(seq.getElementsByTagName("element")));
      for (const e of elems) {
        if ((e.parentNode as any) !== seq) continue;
        emitElement(e, lines, unit);
      }
    }

    // choices
    const choices: XmldomElement[] = Array.from(
      ctx.getElementsByTagName("xsd:choice")
    ).concat(Array.from(ctx.getElementsByTagName("choice")));
    for (const choice of choices) {
      if ((choice.parentNode as any) !== ctx) continue;
      const elems: XmldomElement[] = Array.from(
        choice.getElementsByTagName("xsd:element")
      ).concat(Array.from(choice.getElementsByTagName("element")));
      for (const e of elems) {
        if ((e.parentNode as any) !== choice) continue;
        emitElement(e, lines, unit);
      }
    }
  }

  function toClassName(candidate: string): string {
    return candidate.replace(/[^A-Za-z0-9_]/g, "_").replace(/^[^A-Za-z_]+/, "");
  }

  function emitElement(e: XmldomElement, lines: string[], unit: GenUnit) {
    const en = e.getAttribute("name");
    const refAttr = e.getAttribute("ref");

    // Handle element references
    if (refAttr && !en) {
      // This is a reference to another element
      const refLocalName = localName(refAttr)!;
      const max = e.getAttribute("maxOccurs") ?? "1";
      const isArray = max === "unbounded" || Number(max) > 1;
      const nillable = e.getAttribute("nillable") === "true";

      // Try to resolve the referenced element
      const referencedElement = topLevelElements.find(
        (el) => el.getAttribute("name") === refLocalName
      );

      if (referencedElement) {
        // Use the referenced element's type and namespace
        const refType = referencedElement.getAttribute("type");
        const refNs =
          referencedElement.getAttribute("targetNamespace") ||
          (referencedElement.parentNode as any)?.getAttribute?.(
            "targetNamespace"
          );

        let tsType = "any";
        if (refType) {
          const local = localName(refType)!;
          // Check if it's an enum type
          if (enumTypesMap.has(local)) {
            tsType = local;
            unit.deps.add(local);
          } else {
            tsType = typeMapping(refType);
            if (!isBuiltinType(refType)) {
              unit.deps.add(local);
            }
          }
        }

        const decoratorOpts: string[] = [`type: ${tsType}`];
        if (isArray) decoratorOpts.push("array: true");
        if (nillable) decoratorOpts.push("nillable: true");
        if (refNs) decoratorOpts.push(`namespace: '${refNs}'`);

        lines.push(
          `  @XmlElement('${refLocalName}', { ${decoratorOpts.join(", ")} })`
        );
        lines.push(`  ${refLocalName}?: ${tsType}${isArray ? "[]" : ""};`);
        lines.push("");
      }
      return;
    }

    if (!en) return;
    const typeAttr = e.getAttribute("type");
    const max = e.getAttribute("maxOccurs") ?? "1";
    const isArray = max === "unbounded" || Number(max) > 1;
    const nillable = e.getAttribute("nillable") === "true";
    const ens = elementNamespaceFor(e, false);

    let tsType = "any";

    if (typeAttr) {
      const local = localName(typeAttr)!;
      // Check if it's an enum type
      if (enumTypesMap.has(local)) {
        tsType = local;
        unit.deps.add(local);
      } else {
        tsType = typeMapping(typeAttr);
        if (!isBuiltinType(typeAttr)) {
          unit.deps.add(local);
        }
      }
    } else {
      // anonymous type inline
      const inlineCT =
        e.getElementsByTagName("xsd:complexType")[0] ||
        e.getElementsByTagName("complexType")[0];
      const inlineST =
        e.getElementsByTagName("xsd:simpleType")[0] ||
        e.getElementsByTagName("simpleType")[0];
      if (inlineCT) {
        const anonName = toClassName(en + "Type");
        ensureClass(anonName, inlineCT as any);
        tsType = anonName;
      } else if (inlineST) {
        // Check if inline simpleType is an enumeration
        const rest =
          (inlineST as any).getElementsByTagName("xsd:restriction")[0] ||
          (inlineST as any).getElementsByTagName("restriction")[0];
        if (rest) {
          const enumValues = extractEnumValues(rest as XmldomElement);
          if (enumValues.length > 0) {
            // Generate inline enum type
            const anonEnumName = toClassName(en + "Enum");
            const enumCode = generateEnumCode(anonEnumName, enumValues);
            generatedEnums.set(anonEnumName, enumCode);
            tsType = anonEnumName;
            unit.deps.add(anonEnumName);
          } else {
            const base = (rest as XmldomElement).getAttribute("base");
            tsType = typeMapping(base || "string");
          }
        } else {
          tsType = "any";
        }
      } else {
        tsType = "any";
      }
    }

    const decoratorOpts: string[] = [`type: ${tsType}`];
    if (isArray) decoratorOpts.push("array: true");
    if (nillable) decoratorOpts.push("nillable: true");
    if (ens) decoratorOpts.push(`namespace: '${ens}'`);

    lines.push(`  @XmlElement('${en}', { ${decoratorOpts.join(", ")} })`);
    lines.push(`  ${en}?: ${tsType}${isArray ? "[]" : ""};`);
    lines.push("");
  }

  // 1) Generate classes for all named complexTypes
  for (const [name, ct] of complexTypesMap.entries()) {
    ensureClass(name, ct);
  }

  // 2) Generate classes from top-level elements
  for (const el of topLevelElements) {
    const en = el.getAttribute("name");
    if (!en) continue;
    const typeAttr = el.getAttribute("type");
    const inlineCT =
      el.getElementsByTagName("xsd:complexType")[0] ||
      el.getElementsByTagName("complexType")[0];
    const inlineST =
      el.getElementsByTagName("xsd:simpleType")[0] ||
      el.getElementsByTagName("simpleType")[0];

    // Detect name collision with existing types
    const hasCollision =
      complexTypesMap.has(en) || simpleTypesMap.has(en) || generated.has(en);
    const className = hasCollision ? `${en}Element` : en;

    if (typeAttr) {
      const local = localName(typeAttr)!;
      if (complexTypesMap.has(local)) {
        // Wrapper root class that extends base
        const unit: GenUnit = { lines: [], deps: new Set([local]) };
        generated.set(className, unit);
        emitHeader(unit.lines);
        unit.lines.push("");
        const prefixObj = schemaPrefixes.size
          ? `, prefixes: { ${Array.from(schemaPrefixes.entries())
              .map(([uri, p]) => `'${uri}': '${p}'`)
              .join(", ")} }`
          : "";
        unit.lines.push(
          `@XmlRoot('${en}'${
            targetNs ? `, { namespace: '${targetNs}'${prefixObj} }` : ""
          })`
        );
        unit.lines.push(`export class ${className} extends ${local} {}`);
      } else if (enumTypesMap.has(local)) {
        // Enum wrapper
        const unit: GenUnit = { lines: [], deps: new Set([local]) };
        generated.set(className, unit);
        emitHeader(unit.lines);
        unit.lines.push("");
        const prefixObj = schemaPrefixes.size
          ? `, prefixes: { ${Array.from(schemaPrefixes.entries())
              .map(([uri, p]) => `'${uri}': '${p}'`)
              .join(", ")} }`
          : "";
        unit.lines.push(
          `@XmlRoot('${en}'${
            targetNs ? `, { namespace: '${targetNs}'${prefixObj} }` : ""
          })`
        );
        unit.lines.push(`export class ${className} {`);
        unit.lines.push(`  @XmlText()`);
        unit.lines.push(`  value?: ${local};`);
        unit.lines.push("}");
      } else if (simpleTypesMap.has(local) || isBuiltinType(typeAttr)) {
        // Text wrapper
        const unit: GenUnit = { lines: [], deps: new Set() };
        generated.set(className, unit);
        emitHeader(unit.lines);
        unit.lines.push("");
        const tsType = typeMapping(typeAttr);
        const prefixObj = schemaPrefixes.size
          ? `, prefixes: { ${Array.from(schemaPrefixes.entries())
              .map(([uri, p]) => `'${uri}': '${p}'`)
              .join(", ")} }`
          : "";
        unit.lines.push(
          `@XmlRoot('${en}'${
            targetNs ? `, { namespace: '${targetNs}'${prefixObj} }` : ""
          })`
        );
        unit.lines.push(`export class ${className} {`);
        unit.lines.push(`  @XmlText()`);
        unit.lines.push(`  value?: ${tsType};`);
        unit.lines.push("}");
      }
    } else if (inlineCT) {
      ensureClass(className, inlineCT as any, en);
    } else if (inlineST) {
      const rest =
        (inlineST as any).getElementsByTagName("xsd:restriction")[0] ||
        (inlineST as any).getElementsByTagName("restriction")[0];

      let tsType: string;
      let isEnum = false;

      if (rest) {
        const enumValues = extractEnumValues(rest as XmldomElement);
        if (enumValues.length > 0) {
          // Generate inline enum type
          const anonEnumName = toClassName(en + "Enum");
          const enumCode = generateEnumCode(anonEnumName, enumValues);
          generatedEnums.set(anonEnumName, enumCode);
          tsType = anonEnumName;
          isEnum = true;
        } else {
          const base = (rest as XmldomElement).getAttribute("base");
          tsType = typeMapping(base || "string");
        }
      } else {
        tsType = "any";
      }

      const unit: GenUnit = {
        lines: [],
        deps: isEnum ? new Set([tsType]) : new Set(),
      };
      generated.set(className, unit);
      emitHeader(unit.lines);
      unit.lines.push("");
      const prefixObj2 = schemaPrefixes.size
        ? `, prefixes: { ${Array.from(schemaPrefixes.entries())
            .map(([uri, p]) => `'${uri}': '${p}'`)
            .join(", ")} }`
        : "";
      unit.lines.push(
        `@XmlRoot('${en}'${
          targetNs ? `, { namespace: '${targetNs}'${prefixObj2} }` : ""
        })`
      );
      unit.lines.push(`export class ${className} {`);
      unit.lines.push(`  @XmlText()`);
      unit.lines.push(`  value?: ${tsType};`);
      unit.lines.push("}");
    }
  }

  // Write files with imports
  for (const [name, unit] of generated.entries()) {
    const lines: string[] = [];
    // first line is the Xml* import in unit.lines[0]
    lines.push(...unit.lines.slice(0, 1));
    // add imports of deps
    for (const dep of unit.deps) {
      if (dep === name) continue;
      lines.push(`import { ${dep} } from './${dep}';`);
    }
    // rest of content
    lines.push(...unit.lines.slice(1));

    const code = lines.join("\n");
    const file = join(outDir, name + ".ts");
    writeFileSync(file, code, "utf8");
    console.log("Wrote", file);
  }

  // Write enum files
  for (const [name, enumCode] of generatedEnums.entries()) {
    const file = join(outDir, name + ".ts");
    writeFileSync(file, enumCode, "utf8");
    console.log("Wrote", file);
  }
}
