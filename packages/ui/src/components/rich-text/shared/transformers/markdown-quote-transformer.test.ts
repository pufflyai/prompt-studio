import { describe, expect, test } from "bun:test";
import { $convertFromMarkdownString, $convertToMarkdownString } from "@lexical/markdown";
import { registerRichText } from "@lexical/rich-text";
import { $createParagraphNode, $getRoot, $getSelection, $isRangeSelection, KEY_ENTER_COMMAND } from "lexical";
import { registerQuoteExitShortcut } from "../../markdown-editor/plugins/quote-exit-shortcut";
import { exportLexicalToMarkdown, importMarkdownToLexical } from "../markdown-codec";
import { createHeadlessEditor, editorTransformers } from "./markdown-transformers-test-utils";

const insertText = (text: string) => {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) throw new Error("Expected a text cursor");
  selection.insertText(text);
};

const createTypedQuote = () => {
  const editor = createHeadlessEditor();
  registerRichText(editor);
  registerQuoteExitShortcut(editor);
  editor.update(
    () => {
      const paragraph = $createParagraphNode();
      $getRoot().append(paragraph);
      paragraph.selectStart();
      const transformer = editorTransformers.find((entry) => entry.type === "element" && entry.regExp.test("> "));
      if (transformer?.type !== "element") throw new Error("Missing quote shortcut");
      transformer.replace(paragraph, [], ["> "], false);
    },
    { discrete: true },
  );
  editor.update(() => insertText("First line"), { discrete: true });
  return editor;
};

describe("Markdown quote shortcut", () => {
  test("Enter continues a newly typed quote and Shift+Enter leaves it", () => {
    const editor = createTypedQuote();
    editor.update(
      () => {
        editor.dispatchCommand(KEY_ENTER_COMMAND, { shiftKey: false, preventDefault() {} } as KeyboardEvent);
        insertText("Second line");
      },
      { discrete: true },
    );
    editor.read(() => {
      expect(
        $getRoot()
          .getChildren()
          .map((node) => node.getType()),
      ).toEqual(["quote"]);
      expect(exportLexicalToMarkdown($getRoot())).toBe("> First line\n>\n> Second line");
    });
    editor.update(
      () => {
        editor.dispatchCommand(KEY_ENTER_COMMAND, { shiftKey: true, preventDefault() {} } as KeyboardEvent);
        insertText("Outside");
      },
      { discrete: true },
    );
    editor.read(() => {
      expect(
        $getRoot()
          .getChildren()
          .map((node) => node.getType()),
      ).toEqual(["quote", "paragraph"]);
      expect(exportLexicalToMarkdown($getRoot())).toBe("> First line\n>\n> Second line\n\nOutside");
    });
  });

  test("typed quote content survives saving and reloading", () => {
    const editor = createTypedQuote();
    const markdown = editor.read(() => exportLexicalToMarkdown($getRoot()));
    expect(markdown).toBe("> First line");
    editor.update(() => importMarkdownToLexical(markdown), { discrete: true });
    editor.update(
      () => {
        $getRoot().selectEnd();
        editor.dispatchCommand(KEY_ENTER_COMMAND, { shiftKey: false, preventDefault() {} } as KeyboardEvent);
        insertText("After reload");
      },
      { discrete: true },
    );
    editor.read(() => {
      expect(
        $getRoot()
          .getChildren()
          .map((node) => node.getType()),
      ).toEqual(["quote"]);
      expect(exportLexicalToMarkdown($getRoot())).toBe("> First line\n>\n> After reload");
    });
  });

  test("consecutive imported quote lines remain in the same paragraph", () => {
    const editor = createHeadlessEditor();
    editor.update(() => $convertFromMarkdownString("> First line\n> Second line", editorTransformers), {
      discrete: true,
    });
    editor.read(() => {
      expect($convertToMarkdownString(editorTransformers)).toBe("> First line\n> Second line");
    });
  });
});
