import { describe, expect, test } from "bun:test";
import { registerRichText } from "@lexical/rich-text";
import { $getRoot, $getSelection, $isRangeSelection, KEY_ENTER_COMMAND } from "lexical";
import { $formatQuote } from "./format-quote";
import { exportLexicalToMarkdown, importMarkdownToLexical } from "./markdown-codec";
import { createHeadlessEditor } from "./transformers/markdown-transformers-test-utils";

describe("quote formatting", () => {
  test("Enter continues a quote created from selected paragraphs", () => {
    const editor = createHeadlessEditor();
    registerRichText(editor);
    editor.update(
      () => {
        importMarkdownToLexical("First line\n\nSecond line");
        $formatQuote($getRoot().select(0, 2), false);
        $getRoot().selectEnd();
        editor.dispatchCommand(KEY_ENTER_COMMAND, { shiftKey: false, preventDefault() {} } as KeyboardEvent);
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) throw new Error("Expected a text cursor");
        selection.insertText("Third line");
      },
      { discrete: true },
    );
    editor.read(() => {
      expect(exportLexicalToMarkdown($getRoot())).toBe("> First line\n>\n> Second line\n>\n> Third line");
      expect($getRoot().getChildrenSize()).toBe(1);
    });
  });

  test("toggling a quote off keeps its paragraphs and selected text", () => {
    const editor = createHeadlessEditor();
    editor.update(
      () => {
        importMarkdownToLexical("> First line\n>\n> Second line");
        const selection = $getRoot().select(0, 1);
        const text = selection.getTextContent();
        $formatQuote(selection, true);
        expect($getSelection()?.getTextContent()).toBe(text);
      },
      { discrete: true },
    );
    editor.read(() => {
      expect(exportLexicalToMarkdown($getRoot())).toBe("First line\n\nSecond line");
      expect(
        $getRoot()
          .getChildren()
          .map((node) => node.getType()),
      ).toEqual(["paragraph", "paragraph"]);
    });
  });
});
