import type { Element as XmldomElement } from "@xmldom/xmldom";
import { localName, getChildByLocalName } from "./utils";
import { typeMapping, isBuiltinType } from "./types";
import { emitAttrs } from "./attributes";
import { emitElements } from "./elements";
import type { GeneratorState, GenUnit } from "./codegen";

/**
 * Ensures a class is generated for a given XSD element, creating it if it doesn't exist.
 *
 * Generates a TypeScript class with appropriate decorators based on the XSD structure.
 * Handles simpleContent, complexContent with extension/restriction, and standard
 * sequence/choice/all content models.
 *
 * @param name - The class name to generate
 * @param el - The XSD element (complexType or element with inline type)
 * @param state - The generator state
 * @param xmlName - The XML element name (defaults to class name)
 * @returns The generation unit for the class
 */
export function ensureClass(
  name: string,
  el: XmldomElement,
  state: GeneratorState,
  xmlName?: string
): GenUnit {
  if (state.generated.has(name)) return state.generated.get(name)!;

  const unit: GenUnit = { lines: [], deps: new Set() };
  state.generated.set(name, unit);

  const lines = unit.lines;
  const rootName = xmlName ?? name;
  const mixed = el.getAttribute("mixed") === "true";
  const complexContent = getChildByLocalName(
    el,
    "complexContent",
    state.xsdPrefix
  );
  const simpleContent = getChildByLocalName(
    el,
    "simpleContent",
    state.xsdPrefix
  );

  emitRootDecorator(rootName, state, lines);

  if (simpleContent) {
    handleSimpleContent(name, simpleContent, lines, state);
    return unit;
  }

  if (complexContent) {
    const handled = handleComplexContent(
      name,
      complexContent,
      lines,
      unit,
      state,
      mixed
    );
    if (handled) return unit;
  }

  // Default: complexType with sequence/choice/attributes
  lines.push(`export class ${name} {`);
  emitAttrs(el, lines, state);
  emitElements(el, lines, unit, state, (n, e, x) =>
    ensureClass(n, e, state, x)
  );
  if (mixed) {
    emitMixedText(lines);
  }
  lines.push("}");
  return unit;
}

/**
 * Emits the @XmlRoot decorator for a class.
 * Includes namespace and prefix configuration if present in the schema.
 *
 * @param rootName - The XML root element name
 * @param state - The generator state
 * @param lines - The output lines array
 */
function emitRootDecorator(
  rootName: string,
  state: GeneratorState,
  lines: string[]
): void {
  const prefixObj = state.schemaContext.schemaPrefixes.size
    ? `, prefixes: { ${Array.from(state.schemaContext.schemaPrefixes.entries())
        .map(([uri, p]) => `'${uri}': '${p}'`)
        .join(", ")} }`
    : "";
  lines.push(
    `@XmlRoot('${rootName}'${
      state.schemaContext.targetNs
        ? `, { namespace: '${state.schemaContext.targetNs}'${prefixObj} }`
        : ""
    })`
  );
}

/**
 * Handles XSD simpleContent by generating a class with a @XmlText value property.
 * The class may also have attributes from extension or restriction.
 *
 * @param name - The class name
 * @param simpleContent - The XSD simpleContent element
 * @param lines - The output lines array
 * @param state - The generator state
 */
function handleSimpleContent(
  name: string,
  simpleContent: XmldomElement,
  lines: string[],
  state: GeneratorState
): void {
  const ext =
    getChildByLocalName(simpleContent as any, "extension", state.xsdPrefix) ||
    getChildByLocalName(simpleContent as any, "restriction", state.xsdPrefix);
  let textTs = "String";
  if (ext) {
    const base = (ext as XmldomElement).getAttribute("base");
    if (base) textTs = typeMapping(base);
  }
  lines.push(`export class ${name} {`);
  lines.push(`  @XmlText()`);
  lines.push(`  value?: ${textTs};`);
  lines.push("");
  if (ext) emitAttrs(ext as any, lines, state);
  lines.push("}");
}

/**
 * Handles XSD complexContent by processing extension or restriction.
 *
 * @param name - The class name
 * @param complexContent - The XSD complexContent element
 * @param lines - The output lines array
 * @param unit - The generation unit
 * @param state - The generator state
 * @param mixed - Whether the content is mixed (allows text)
 * @returns True if handled, false otherwise
 */
function handleComplexContent(
  name: string,
  complexContent: XmldomElement,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  mixed: boolean
): boolean {
  const ext = getChildByLocalName(
    complexContent as any,
    "extension",
    state.xsdPrefix
  );
  const rest = getChildByLocalName(
    complexContent as any,
    "restriction",
    state.xsdPrefix
  );

  if (ext) {
    handleExtension(name, ext, lines, unit, state, mixed);
    return true;
  } else if (rest) {
    handleRestriction(name, rest, lines, unit, state, mixed);
    return true;
  }

  return false;
}

/**
 * Handles XSD extension within complexContent.
 * Generates a class that extends the base type and adds new properties.
 *
 * @param name - The class name
 * @param ext - The XSD extension element
 * @param lines - The output lines array
 * @param unit - The generation unit
 * @param state - The generator state
 * @param mixed - Whether the content is mixed
 */
function handleExtension(
  name: string,
  ext: XmldomElement,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  mixed: boolean
): void {
  const base = (ext as XmldomElement).getAttribute("base");
  const baseLocal = localName(base);
  let extendsBase: string | undefined;

  if (baseLocal && !isBuiltinType(base)) {
    extendsBase = baseLocal;
    unit.deps.add(baseLocal);
  }

  lines.push(
    `export class ${name}${extendsBase ? ` extends ${extendsBase}` : ""} {`
  );
  emitAttrs(ext as any, lines, state);
  emitElements(ext as any, lines, unit, state, (n, e, x) =>
    ensureClass(n, e, state, x)
  );
  if (mixed) {
    emitMixedText(lines);
  }
  lines.push("}");
}

/**
 * Handles XSD restriction within complexContent.
 * Generates a class with restricted content (no base class extension).
 *
 * @param name - The class name
 * @param rest - The XSD restriction element
 * @param lines - The output lines array
 * @param unit - The generation unit
 * @param state - The generator state
 * @param mixed - Whether the content is mixed
 */
function handleRestriction(
  name: string,
  rest: XmldomElement,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  mixed: boolean
): void {
  lines.push(`export class ${name} {`);
  emitAttrs(rest as any, lines, state);
  emitElements(rest as any, lines, unit, state, (n, e, x) =>
    ensureClass(n, e, state, x)
  );
  if (mixed) {
    emitMixedText(lines);
  }
  lines.push("}");
}

/**
 * Emits a text content property for mixed content elements.
 * Mixed content allows elements to contain both text and child elements.
 *
 * @param lines - The output lines array
 */
function emitMixedText(lines: string[]): void {
  lines.push(`  @XmlText()`);
  lines.push(`  value?: String;`);
  lines.push("");
}
