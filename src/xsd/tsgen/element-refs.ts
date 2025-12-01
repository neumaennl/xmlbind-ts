import type { Element as XmldomElement } from "@xmldom/xmldom";
import { localName, getDocumentation, formatTsDoc, getChildByLocalName } from "./utils";
import { typeMapping, sanitizeTypeName, isPrimitiveTypeName } from "./types";
import { toPropertyName } from "./codegen";
import type { GeneratorState, GenUnit } from "./codegen";
import { handleInlineType } from "./element-types";
import { toClassName } from "./codegen";

/**
 * Resolves the namespace URI for a qualified name in the context of an element.
 * @param qname - The qualified name (e.g., "xs:string", "tns:myElement")
 * @param contextElement - The element in which the QName appears (for namespace resolution)
 * @returns The namespace URI, or undefined if no prefix (refers to target namespace)
 */
export function resolveNamespace(qname: string, contextElement: XmldomElement): string | undefined {
  if (!qname.includes(":")) {
    // No prefix - refers to target namespace
    return undefined;
  }
  const prefix = qname.split(":")[0];
  // Use lookupNamespaceURI if available (modern browsers and xmldom)
  return contextElement.lookupNamespaceURI?.(prefix) || undefined;
}

/**
 * Determines if a minOccurs attribute value indicates an array (multiple required occurrences).
 * @param minOccurs - The minOccurs attribute value (e.g., "0", "1", "2")
 * @returns True if the element must appear multiple times (minOccurs > 1)
 */
function isArrayFromMinOccurs(minOccurs: string | null): boolean {
  if (!minOccurs) return false; // default is "1", so not array
  const numValue = Number(minOccurs);
  if (isNaN(numValue)) return false;
  return numValue > 1;
}

/**
 * Checks if a property with the given name has already been emitted.
 * @param propName - The property name to check
 * @param lines - The output lines array
 * @returns True if the property has already been emitted
 */
function isPropertyAlreadyEmitted(propName: string, lines: string[]): boolean {
  const propPattern = new RegExp(`^\\s*${propName}[!?]:`);
  return lines.some((line) => propPattern.test(line));
}

/**
 * Finds the referenced top-level element with proper namespace matching.
 * @param refLocalName - The local name of the referenced element
 * @param refNamespace - The namespace of the reference (may be undefined)
 * @param state - The generator state
 * @returns The referenced element, or undefined if not found
 */
function findReferencedElement(
  refLocalName: string,
  refNamespace: string | undefined,
  state: GeneratorState
): XmldomElement | undefined {
  return state.schemaContext.topLevelElements.find((el) => {
    const elName = el.getAttribute("name");
    if (elName !== refLocalName) {
      return false;
    }
    
    // Get element's namespace
    const elementNs = el.getAttribute("targetNamespace") || 
                      (el.parentNode as any)?.getAttribute?.("targetNamespace") ||
                      state.schemaContext.targetNs;
    
    // If reference has no prefix, it refers to target namespace
    if (!refNamespace) {
      return elementNs === state.schemaContext.targetNs || !elementNs;
    }
    
    // If reference has a prefix, namespaces must match exactly
    return elementNs === refNamespace;
  });
}

/**
 * Emits code for an element reference (ref attribute).
 * Resolves the referenced element and generates the appropriate decorator and property.
 *
 * @param e - The XSD element with a ref attribute
 * @param refAttr - The ref attribute value
 * @param lines - The output lines array
 * @param unit - The generation unit
 * @param state - The generator state
 * @param insideChoice - Whether inside a choice (affects optionality)
 * @param compositorIsArray - Whether inside a compositor with maxOccurs > 1
 * @param compositorIsOptional - Whether inside a compositor with minOccurs = 0
 * @param isArrayFromMaxOccurs - Helper function to check if maxOccurs indicates array
 */
export function emitElementRef(
  e: XmldomElement,
  refAttr: string,
  lines: string[],
  unit: GenUnit,
  state: GeneratorState,
  insideChoice: boolean,
  compositorIsArray: boolean,
  compositorIsOptional: boolean,
  isArrayFromMaxOccurs: (maxOccurs: string | null) => boolean,
  /**
   * Callback used to ensure a generated class exists for an inline complexType.
   * Provided by the caller (elements emitter) so that referenced elements with
   * anonymous inline types can be properly materialized instead of defaulting to 'any'.
   */
  ensureClass: (name: string, el: XmldomElement, xmlName?: string) => GenUnit
): void {
  const refLocalName = localName(refAttr)!;
  const minOccursAttr = e.getAttribute("minOccurs");
  const maxOccursAttr = e.getAttribute("maxOccurs");
  
  const elementIsArrayFromMax = isArrayFromMaxOccurs(maxOccursAttr);
  const elementIsArrayFromMin = isArrayFromMinOccurs(minOccursAttr);
  // Element is an array if:
  // 1. maxOccurs > 1 (can appear multiple times)
  // 2. minOccurs > 1 (must appear multiple times)
  // 3. Inside a compositor with maxOccurs > 1
  const isArray = elementIsArrayFromMax || elementIsArrayFromMin || compositorIsArray;
  const nillable = e.getAttribute("nillable") === "true";
  const min = minOccursAttr ?? "1";
  // Element is required only if it's not in a choice, has minOccurs >= 1, and is not inside an optional compositor
  const makeRequired = !insideChoice && Number(min) >= 1 && !compositorIsOptional;

  // Resolve the namespace of the reference
  const refNamespace = resolveNamespace(refAttr, e);
  
  // Find referenced element with proper namespace matching
  const referencedElement = findReferencedElement(refLocalName, refNamespace, state);

  if (referencedElement) {
    const refType = referencedElement.getAttribute("type");
    const refNs =
      referencedElement.getAttribute("targetNamespace") ||
      (referencedElement.parentNode as any)?.getAttribute?.("targetNamespace");

    let tsType = "any";
    if (refType) {
      // Referenced element explicitly names a type
      const local = localName(refType)!;
      const sanitized = sanitizeTypeName(local);
      if (state.schemaContext.enumTypesMap.has(local)) {
        tsType = sanitized;
        unit.deps.add(sanitized);
      } else {
        tsType = typeMapping(refType);
        if (
          tsType !== "String" &&
          tsType !== "Number" &&
          tsType !== "Boolean" &&
          tsType === sanitized
        ) {
          unit.deps.add(sanitized);
        }
      }
    } else {
      // Referenced element has no explicit type attribute. Use robust naming:
      // Top-level inline complexType => underlying *Type class; inline simpleType => wrapper class.
      const isTopLevel = state.schemaContext.topLevelElements.includes(referencedElement);
      if (isTopLevel) {
        const inlineCT = getChildByLocalName(referencedElement, "complexType", state.xsdPrefix);
        const inlineST = getChildByLocalName(referencedElement, "simpleType", state.xsdPrefix);
        if (inlineCT) {
          const underlyingName = toClassName(refLocalName + "Type", state.reservedWords);
          if (underlyingName !== unit.className) unit.deps.add(underlyingName);
          tsType = underlyingName;
        } else if (inlineST) {
          // Wrapper name for simpleType (may collide -> suffix handled in top-level processing)
          const hasCollision = state.schemaContext.complexTypesMap.has(refLocalName) ||
            state.schemaContext.simpleTypesMap.has(refLocalName) ||
            state.generated.has(toClassName(refLocalName, state.reservedWords));
          const baseName = hasCollision ? `${refLocalName}Element` : refLocalName;
          const wrapperName = toClassName(baseName, state.reservedWords);
          if (wrapperName !== unit.className) unit.deps.add(wrapperName);
          tsType = wrapperName;
        } else {
          tsType = "any";
        }
      } else {
        tsType = handleInlineType(referencedElement, refLocalName, unit, state, ensureClass);
      }
    }

    const propName = toPropertyName(refLocalName, state.reservedWords);
    
    // Check if this property name has already been emitted to avoid duplicates
    if (isPropertyAlreadyEmitted(propName, lines)) {
      return;
    }
    
    // Extract documentation from the referenced element
    const doc = getDocumentation(referencedElement, state.xsdPrefix);
    if (doc) {
      lines.push(...formatTsDoc(doc, "  "));
    }
    
    const decoratorOpts: string[] = [];
    // Don't include type in decorator if it's a self-reference (to avoid "used before declaration" error)
    const isSelfReference = tsType === unit.className;
    if (
      tsType &&
      tsType !== "any" &&
      /^[A-Za-z0-9_]+$/.test(tsType) &&
      !isSelfReference
    ) {
      // Use lazy type reference (arrow function) for non-primitive types to avoid circular dependency issues
      if (isPrimitiveTypeName(tsType)) {
        decoratorOpts.push(`type: ${tsType}`);
      } else {
        decoratorOpts.push(`type: () => ${tsType}`);
      }
    }
    if (isArray) decoratorOpts.push("array: true");
    if (nillable) decoratorOpts.push("nillable: true");
    if (refNs) decoratorOpts.push(`namespace: '${refNs}'`);

    const decoratorBody = decoratorOpts.length
      ? `{ ${decoratorOpts.join(", ")} }`
      : "";
    lines.push(
      decoratorBody
        ? `  @XmlElement('${refLocalName}', ${decoratorBody})`
        : `  @XmlElement('${refLocalName}')`
    );
    lines.push(
      `  ${propName}${makeRequired ? "!" : "?"}: ${tsType}${
        isArray ? "[]" : ""
      };`
    );
    lines.push("");
  }
}
