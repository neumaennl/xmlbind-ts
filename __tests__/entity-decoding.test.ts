import { marshal, unmarshal } from "../src/index.js";
import { Note } from "./test-utils/note.js";

describe("Entity decoding", () => {
  test("decodes decimal and hexadecimal character references", () => {
    const xml = `<Note title="&#65;&#x42;"><text>&#67;&#x44;</text></Note>`;
    const note = unmarshal(Note, xml);

    expect(note.title).toBe("AB");
    expect(note.text).toBe("CD");
  });

  test("decodes character references outside the Basic Multilingual Plane", () => {
    const note = unmarshal(Note, `<Note><text>&#x1F600;&#128512;</text></Note>`);

    expect(note.text).toBe("\u{1F600}\u{1F600}");
  });

  test("decodes the predefined XML entities", () => {
    const xml = `<Note title="&lt;&amp;&gt;"><text>&quot;&apos;</text></Note>`;
    const note = unmarshal(Note, xml);

    expect(note.title).toBe("<&>");
    expect(note.text).toBe(`"'`);
  });

  test("leaves HTML entities that XML does not define", () => {
    const note = unmarshal(Note, `<Note><text>&nbsp;&copy;</text></Note>`);

    expect(note.text).toBe("&nbsp;&copy;");
  });

  test("decodes an escaped character reference only once", () => {
    const note = unmarshal(Note, `<Note><text>&amp;#65;</text></Note>`);

    expect(note.text).toBe("&#65;");
  });

  test("decodes entities declared in the DOCTYPE", () => {
    const xml = `<!DOCTYPE Note [<!ENTITY greeting "Hello">]><Note><text>&greeting;</text></Note>`;
    const note = unmarshal(Note, xml);

    expect(note.text).toBe("Hello");
  });

  test("ignores DOCTYPE entities with unsafe values", () => {
    const xml = `<!DOCTYPE Note [<!ENTITY xss "<script>alert(1)</script>">]><Note><text>&xss;</text></Note>`;
    const note = unmarshal(Note, xml);

    expect(note.text).toBe("&xss;");
  });

  test("rejects documents whose entities expand to more than 100000 characters", () => {
    const entity = `<!ENTITY e "${"a".repeat(9000)}">`;
    const xml = (refs: number) =>
      `<!DOCTYPE Note [${entity}]><Note><text>${"&e;".repeat(refs)}</text></Note>`;

    expect(unmarshal(Note, xml(11)).text).toHaveLength(99000);
    expect(() => unmarshal(Note, xml(12))).toThrow(/limit exceeded/);
  });

  // Pins the current behavior; see the known issue "Invalid character
  // references are removed without an error", which would make this an error.
  test("removes character references to characters that XML does not allow", () => {
    const note = unmarshal(Note, `<Note><text>a&#0;b&#xD800;c&#1;d</text></Note>`);

    expect(note.text).toBe("abcd");
  });

  test("writes the decoded characters when marshalling", () => {
    const note = unmarshal(Note, `<Note title="&#65;"><text>&#x42;</text></Note>`);
    const xml = marshal(note);

    expect(xml).toContain(`title="A"`);
    expect(xml).toContain("<text>B</text>");
    expect(xml).not.toContain("&amp;#");
  });
});
