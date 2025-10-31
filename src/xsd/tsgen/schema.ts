import type { Element as XmldomElement } from "@xmldom/xmldom";
import { directChildren } from "./xmlutils";
import { getChildByLocalName } from "./utils";
import { extractEnumValues } from "./enum";

export interface SchemaContext {
  targetNs?: string;
  elementFormDefault: string;
  attributeFormDefault: string;
  complexTypesMap: Map<string, XmldomElement>;
  simpleTypesMap: Map<string, XmldomElement>;
  enumTypesMap: Map<string, string[]>;
  groupDefs: Map<string, XmldomElement>;
  attributeGroupDefs: Map<string, XmldomElement>;
  topLevelAttributes: Map<string, XmldomElement>;
  topLevelElements: XmldomElement[];
  schemaPrefixes: Map<string, string>;
}

/**
 * Indexes and organizes all definitions from an XSD schema.
 *
 * Scans the schema for top-level elements, complex types, simple types, enums,
 * groups, attribute groups, and attributes. Builds lookup maps for efficient
 * code generation. Also collects namespace prefixes and processes imports.
 *
 * @param schema - The XSD schema root element
 * @param xsdPrefix - The namespace prefix used for XSD elements
 * @returns A SchemaContext containing all indexed schema components
 */
export function indexSchema(
  schema: XmldomElement,
  xsdPrefix: string
): SchemaContext {
  const targetNs = schema.getAttribute("targetNamespace") ?? undefined;
  const elementFormDefault =
    schema.getAttribute("elementFormDefault") || "unqualified";
  const attributeFormDefault =
    schema.getAttribute("attributeFormDefault") || "unqualified";

  // Index top-level definitions
  const complexTypesMap = new Map<string, XmldomElement>();
  for (const ct of directChildren(schema as any, ["complexType"], xsdPrefix)) {
    const name = ct.getAttribute("name");
    if (name) complexTypesMap.set(name, ct);
  }

  const simpleTypesMap = new Map<string, XmldomElement>();
  const enumTypesMap = new Map<string, string[]>();
  for (const st of directChildren(schema as any, ["simpleType"], xsdPrefix)) {
    const name = st.getAttribute("name");
    if (name) {
      simpleTypesMap.set(name, st);
      const restriction = getChildByLocalName(st, "restriction", xsdPrefix);
      if (restriction) {
        const enumValues = extractEnumValues(
          restriction as XmldomElement,
          xsdPrefix
        );
        if (enumValues.length > 0) {
          enumTypesMap.set(name, enumValues);
        }
      }
    }
  }

  const topLevelElements: XmldomElement[] = directChildren(
    schema as any,
    ["element"],
    xsdPrefix
  );

  const groupDefs = new Map<string, XmldomElement>();
  for (const g of directChildren(schema as any, ["group"], xsdPrefix)) {
    const name = g.getAttribute("name");
    if (name) groupDefs.set(name, g);
  }

  const attributeGroupDefs = new Map<string, XmldomElement>();
  for (const ag of directChildren(
    schema as any,
    ["attributeGroup"],
    xsdPrefix
  )) {
    const name = ag.getAttribute("name");
    if (name) attributeGroupDefs.set(name, ag);
  }

  const topLevelAttributes = new Map<string, XmldomElement>();
  for (const attr of directChildren(schema as any, ["attribute"], xsdPrefix)) {
    const name = attr.getAttribute("name");
    if (name) topLevelAttributes.set(name, attr);
  }

  const schemaPrefixes = collectSchemaPrefixes(schema);
  processSchemaImports(schema, xsdPrefix, schemaPrefixes);

  return {
    targetNs,
    elementFormDefault,
    attributeFormDefault,
    complexTypesMap,
    simpleTypesMap,
    enumTypesMap,
    groupDefs,
    attributeGroupDefs,
    topLevelAttributes,
    topLevelElements,
    schemaPrefixes,
  };
}

/**
 * Collects namespace prefix declarations from the schema root element.
 * Scans for xmlns:prefix attributes and builds a map of namespace URIs to prefixes.
 *
 * @param schema - The XSD schema root element
 * @returns A map from namespace URI to prefix
 */
function collectSchemaPrefixes(schema: XmldomElement): Map<string, string> {
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
  return schemaPrefixes;
}

/**
 * Processes schema import declarations and ensures prefixes for imported namespaces.
 *
 * Scans for xs:import elements and generates prefixes for any imported namespaces
 * that don't already have a prefix declared.
 *
 * @param schema - The XSD schema root element
 * @param xsdPrefix - The namespace prefix used for XSD elements
 * @param schemaPrefixes - The map of namespace URIs to prefixes (modified in place)
 */
function processSchemaImports(
  schema: XmldomElement,
  xsdPrefix: string,
  schemaPrefixes: Map<string, string>
): void {
  const importedNamespaces = new Set<string>();
  for (const imp of directChildren(schema as any, ["import"], xsdPrefix)) {
    const ns = imp.getAttribute("namespace");
    if (ns) {
      importedNamespaces.add(ns);
      if (!schemaPrefixes.has(ns)) {
        const prefix = `imp${importedNamespaces.size}`;
        schemaPrefixes.set(ns, prefix);
      }
    }
  }
}
