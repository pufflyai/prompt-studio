import { expect, test } from "bun:test";
import { readNoteSource, writeNoteSource } from "./notes";
import { createNotesMount } from "./test-mount";

test("the editor saves the whole note and preserves its existing front matter bytes", async () => {
  const mount = createNotesMount();
  const source = "---\r\ntitle: 'A title'\r\nunknown: [a, b]  \r\n---\r\n\r\nBody\r\n";
  await mount.writeText("note/content.md", source);
  expect(await readNoteSource(mount, "note")).toBe(source);
  const edited = source.replace("Body", "Edited body");
  await writeNoteSource(mount, "note", edited);
  expect(await mount.readText("note/content.md")).toBe(edited);
});

test("a full source save derives the first title without rewriting unrelated front matter", async () => {
  const mount = createNotesMount();
  await mount.writeText("note/content.md", '---\r\ntitle: ""\r\ncustom: keep  \r\n---\r\n\r\n');
  await writeNoteSource(mount, "note", '---\r\ntitle: ""\r\ncustom: keep  \r\n---\r\n\r\n# First title\r\n');
  expect(await mount.readText("note/content.md")).toBe(
    '---\r\ntitle: "First title"\r\ncustom: keep  \r\n---\r\n\r\n# First title\r\n',
  );
});
