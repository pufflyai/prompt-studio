import { expect, test } from "bun:test";
import * as Y from "yjs";
import { createMarkdownTableDraft } from "./markdown-table-draft";
import { markdownSourceTables } from "./markdown-table-source-positions";
import { createMarkdownTextDocument } from "./markdown-text-document";

for (const [name, rowIndex, value, replacement, sourceWord, expectedWord] of [
  ["cell", 1, "left", "left draft", "left", "REMOTE left draft"],
  ["header", 0, "**A**", "**A** draft", "__A__", "REMOTE __A__ draft"],
] as const)
  test(`saving a ${name} draft retains a peer prefix and uses one local undo step`, () => {
    const initial = "---\ntitle: Keep\n---\n\n| __A__ | B |\n| --- | --- |\n| left | right |";
    const shared = new Y.Doc();
    shared.getText("content").insert(0, initial);
    const binding = createMarkdownTextDocument(shared);
    const draft = createMarkdownTableDraft({ binding, tableIndex: 0, rowIndex, columnIndex: 0, value });
    const text = shared.getText("content");
    text.insert(text.toString().indexOf(sourceWord), "REMOTE ");
    draft.commit(replacement);
    expect(text.toString()).toContain(expectedWord);
    expect(text.toString().startsWith("---\ntitle: Keep\n---\n\n")).toBe(true);
    binding.undo();
    expect(text.toString()).toBe(initial.replace(sourceWord, `REMOTE ${sourceWord}`));
    binding.redo();
    expect(text.toString()).toContain(expectedWord);
    draft.dispose();
    binding.destroy();
    shared.destroy();
  });

test("a cell draft retains its source target after a peer inserts an earlier row", () => {
  const initial = "| A | B |\n| --- | --- |\n| left | right |";
  const shared = new Y.Doc();
  shared.getText("content").insert(0, initial);
  const binding = createMarkdownTextDocument(shared);
  const draft = createMarkdownTableDraft({ binding, tableIndex: 0, rowIndex: 1, columnIndex: 0, value: "left" });
  const text = shared.getText("content");
  text.insert(text.toString().indexOf("| left"), "| added | row |\n");
  text.insert(text.toString().indexOf("left"), "REMOTE ");
  draft.commit("left draft");
  expect(text.toString()).toBe("| A | B |\n| --- | --- |\n| added | row |\n| REMOTE left draft | right |");
  draft.dispose();
  binding.destroy();
  shared.destroy();
});

for (const [loaded, value, draft, encoded] of [
  ["left", "left", "left | extra", "left \\| extra"],
  ["left \\| kept", "left | kept", "left | kept | extra", "left \\| kept \\| extra"],
  ["left", "left", "left\nextra", "left<br>extra"],
] as const)
  test(`table drafts retain two columns when saving ${JSON.stringify(draft)}`, () => {
    const initial = `| A | B |\n| --- | --- |\n| ${loaded} | right |`;
    const shared = new Y.Doc();
    shared.getText("content").insert(0, initial);
    const binding = createMarkdownTextDocument(shared);
    const edit = createMarkdownTableDraft({ binding, tableIndex: 0, rowIndex: 1, columnIndex: 0, value });
    edit.commit(draft);
    const source = shared.getText("content").toString();
    expect(source).toContain(`| ${encoded} | right |`);
    expect(markdownSourceTables(source)[0]!.children[1]!.children).toHaveLength(2);
    edit.dispose();
    binding.destroy();
    shared.destroy();
  });
