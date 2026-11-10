import { XmlRoot, XmlElement, XmlAttribute } from "../../src/index.js";

/**
 * A minimal bound class with one string attribute and one string element,
 * for tests of how values are read and written.
 */
@XmlRoot("Note")
export class Note {
  @XmlAttribute("title")
  title?: string;

  @XmlElement("text", { type: String })
  text?: string;
}
