import { marshal, unmarshal } from "../src/index.js";
import { Note } from "./test-utils/note.js";

/**
 * Creates a note with the given title and text.
 *
 * @param title - The value of the attribute `title`
 * @param text - The text of the element `text`
 * @returns The note
 */
function note(title: string, text: string): Note {
  return Object.assign(new Note(), { title, text });
}

describe("Marshal escaping", () => {
  test("escapes markup characters in attribute values and element text", () => {
    const xml = marshal(note(`<a & "b" 'c'>`, `<a & "b" 'c'>`));

    expect(xml).toContain(`title="&lt;a &amp; &quot;b&quot; &apos;c&apos;&gt;"`);
    expect(xml).toContain(`<text>&lt;a &amp; &quot;b&quot; &apos;c&apos;&gt;</text>`);
  });

  test("writes carriage returns in element text as character references", () => {
    const xml = marshal(note("", "a\rb\nc\td"));

    expect(xml).toContain("<text>a&#13;b\nc\td</text>");
  });

  test("writes carriage returns in attribute values as character references", () => {
    const xml = marshal(note("a\rb\nc\td", ""));

    expect(xml).toContain(`title="a&#13;b\nc\td"`);
  });

  test("keeps carriage return references on a round trip", () => {
    const source = `<Note title="a&#13;b"><text>c&#13;d</text></Note>`;
    const again = unmarshal(Note, marshal(unmarshal(Note, source)));

    expect(again.title).toBe("a\rb");
    expect(again.text).toBe("c\rd");
  });

  test("keeps literal line breaks in attribute values", () => {
    const xml = marshal(unmarshal(Note, `<Note title="a\n  b"/>`));

    expect(xml).toContain(`title="a\n  b"`);
  });
});
