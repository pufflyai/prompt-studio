import { expect, test } from "bun:test";
import { $createTextNode, $getRoot, $isParagraphNode } from "lexical";
import { createMarkdownSourceDocument } from "./markdown-source-document";
import { createHeadlessEditor } from "./transformers/markdown-transformers-test-utils";

test("an empty document accepts its first edit in an initialized paragraph", () => {
  const editor = createHeadlessEditor();
  const document = createMarkdownSourceDocument("");
  editor.update(() => document.importToLexical(), { discrete: true });
  expect(editor.getEditorState().isEmpty()).toBe(false);
  editor.update(
    () => {
      const paragraph = $getRoot().getFirstChild();
      expect($isParagraphNode(paragraph)).toBe(true);
      if ($isParagraphNode(paragraph)) paragraph.append($createTextNode("My first note"));
    },
    { discrete: true },
  );
  editor.read(() => expect(document.exportFromLexical($getRoot())).toBe("My first note"));
});
