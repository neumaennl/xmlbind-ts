import {
  XmlAnyElement,
  XmlAttribute,
  XmlElement,
  XmlRoot,
  XmlText,
} from "../src/decorators/index.js";
import { marshal, unmarshal } from "../src/marshalling/index.js";

/**
 * Element text reaches the field's type unchanged; the XML parser does not
 * convert text that looks like a number or boolean (#275).
 */

/** Element texts that a conversion to a number would change. */
const NUMBER_LIKE = ["007", "1.50", "1.0", "0x1A", "1e3", "-0"];

enum Version {
  V1_0 = "1.0",
  V2_0 = "2.0",
}

class Code {
  @XmlAttribute("system")
  system?: string;

  @XmlText({ type: String })
  value?: string;
}

@XmlRoot("doc")
class Doc {
  @XmlElement("text", { type: String })
  text?: string;

  @XmlElement("code", { type: Code })
  code?: Code;

  @XmlElement("version", { type: String })
  version?: Version;

  @XmlElement("count", { type: Number })
  count?: number;

  @XmlElement("flag", { type: Boolean })
  flag?: boolean;
}

@XmlRoot("label")
class Label {
  @XmlText({ type: String })
  value?: string;
}

describe("Element text values", () => {
  test.each(NUMBER_LIKE)("keeps %s in a String element and an @XmlText() field", (value) => {
    const xml = `<doc><text>${value}</text><code system="s">${value}</code></doc>`;
    const doc = unmarshal(Doc, xml);

    expect(doc.text).toBe(value);
    expect(doc.code?.value).toBe(value);
    const written = marshal(doc);
    expect(written).toContain(`<text>${value}</text>`);
    expect(written).toContain(`<code system="s">${value}</code>`);
  });

  test("keeps number-like text of the root's @XmlText() field", () => {
    const label = unmarshal(Label, `<label>007</label>`);

    expect(label.value).toBe("007");
    expect(marshal(label)).toContain(">007</label>");
  });

  test("keeps an enum value that looks like a number", () => {
    const doc = unmarshal(Doc, `<doc><version>1.0</version></doc>`);

    expect(doc.version).toBe(Version.V1_0);
    expect(marshal(doc)).toContain("<version>1.0</version>");
  });

  test("still converts Number and Boolean elements", () => {
    const doc = unmarshal(Doc, `<doc><count>007</count><flag>1</flag></doc>`);

    expect(doc.count).toBe(7);
    expect(doc.flag).toBe(true);
  });

  test("keeps number-like and boolean-like text of an untyped field as a string", () => {
    @XmlRoot("doc")
    class Untyped {
      @XmlElement("value")
      value?: unknown;
    }

    expect(unmarshal(Untyped, `<doc><value>007</value></doc>`).value).toBe("007");
    expect(unmarshal(Untyped, `<doc><value>true</value></doc>`).value).toBe("true");
  });

  test("keeps number-like text in wildcard elements", () => {
    @XmlRoot("doc")
    class Open {
      @XmlAnyElement()
      any?: unknown[];
    }

    const open = unmarshal(Open, `<doc><zip>01234</zip></doc>`);

    expect(marshal(open)).toContain("<zip>01234</zip>");
  });
});
