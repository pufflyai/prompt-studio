import { expect, test } from "bun:test";
import { $getRoot, $getSelection, $isRangeSelection } from "lexical";
import { createMarkdownSourceDocument } from "./markdown-source-document";
import { createHeadlessEditor } from "./transformers/markdown-transformers-test-utils";

test("remote Markdown changes retain unchanged blocks and the selection inside them", () => {
  const editor = createHeadlessEditor();
  const source = createMarkdownSourceDocument("First __source__.\n\nSelected text.\n\nLast text.");
  let key = "";
  editor.update(
    () => {
      source.importToLexical();
      const selected = $getRoot()
        .getAllTextNodes()
        .find((node) => node.getTextContent() === "Selected text.")!;
      key = selected.getKey();
      selected.select(3, 8);
    },
    { discrete: true },
  );
  editor.update(() => source.reconcileFromSource("First __changed__.\n\nSelected text.\n\nLast text."), {
    discrete: true,
  });
  editor.read(() => {
    const selection = $getSelection();
    expect($isRangeSelection(selection)).toBe(true);
    if (!$isRangeSelection(selection)) throw new Error("Missing range selection");
    expect(selection.anchor.key).toBe(key);
    expect(selection.anchor.offset).toBe(3);
    expect(selection.focus.offset).toBe(8);
    expect(source.exportFromLexical($getRoot())).toBe("First __changed__.\n\nSelected text.\n\nLast text.");
  });
});

test("source changes update link definitions and retain exact spelling for the next local edit", () => {
  const editor = createHeadlessEditor();
  const source = createMarkdownSourceDocument(
    "[Link][target]\r\n\r\nKeep __syntax__.\r\n\r\n[target]: https://old.example",
  );
  const remote = "[Link][target]\r\n\r\nKeep __syntax__.\r\n\r\n[target]: https://new.example";
  editor.update(() => source.importToLexical(), { discrete: true });
  editor.update(() => source.reconcileFromSource(remote), { discrete: true });
  editor.update(
    () => {
      const node = $getRoot()
        .getAllTextNodes()
        .find((node) => node.getTextContent() === "Keep ")!;
      node.setTextContent("Retain ");
    },
    { discrete: true },
  );
  editor.read(() => expect(source.exportFromLexical($getRoot())).toBe(remote.replace("Keep", "Retain")));
});
