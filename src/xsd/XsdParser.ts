import { DOMParser } from "@xmldom/xmldom";
import type {
  Document as XmldomDocument,
  Element as XmldomElement,
} from "@xmldom/xmldom";

export function parseXsd(xsdText: string): XmldomDocument {
  return new DOMParser().parseFromString(xsdText, "application/xml");
}

export function getSchemaRoot(doc: XmldomDocument): XmldomElement | undefined {
  return (
    doc.getElementsByTagName("xsd:schema")[0] ||
    doc.getElementsByTagName("schema")[0]
  );
}
