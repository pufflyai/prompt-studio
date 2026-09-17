import { describe, expect, test } from "bun:test";
import { registerMarkdownShortcuts } from "@lexical/markdown";
import { registerRichText } from "@lexical/rich-text";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $selectAll,
  DELETE_CHARACTER_COMMAND,
  FORMAT_TEXT_COMMAND,
  REMOVE_TEXT_COMMAND,
  SELECT_ALL_COMMAND,
} from "lexical";
import { exportLexicalToMarkdown, importMarkdownToLexical } from "../../shared/markdown-codec";
import { createHeadlessEditor, editorTransformers } from "../../shared/transformers/markdown-transformers-test-utils";
import { registerClearEditorSelection } from "./clear-editor-selection";

function createEditor(markdown: string) {
  const editor = createHeadlessEditor();
  registerRichText(editor);
  registerClearEditorSelection(editor);
  registerMarkdownShortcuts(editor, editorTransformers);
  editor.update(
    () => {
      importMarkdownToLexical(markdown);
      $getRoot().selectEnd();
    },
    { discrete: true },
  );
  return editor;
}

describe("clearing the Markdown editor", () => {
  test("deleting the document clears the active inline format", () => {
    const editor = createEditor("Formatted text");
    editor.update(
      () => {
        editor.dispatchCommand(SELECT_ALL_COMMAND, undefined);
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code");
        editor.dispatchCommand(DELETE_CHARACTER_COMMAND, true);
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) throw new Error("Expected a text cursor");
        selection.insertText("Plain text");
      },
      { discrete: true },
    );
    editor.read(() => expect(exportLexicalToMarkdown($getRoot())).toBe("Plain text"));
  });

  test.each([
    "> Quote",
    "# Heading\n\n> Quote",
    "> **Formatted quote**",
  ])("selecting all and deleting %s allows a new quote shortcut", async (markdown) => {
    const editor = createEditor(markdown);
    for (let attempt = 0; attempt < 2; attempt++) {
      editor.update(
        () => {
          editor.dispatchCommand(SELECT_ALL_COMMAND, undefined);
          editor.dispatchCommand(DELETE_CHARACTER_COMMAND, true);
        },
        { discrete: true },
      );
      editor.read(() => {
        expect(
          $getRoot()
            .getChildren()
            .map((node) => node.getType()),
        ).toEqual(["paragraph"]);
      });
      for (const character of "> New quote") {
        editor.update(
          () => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) throw new Error("Expected a text cursor");
            selection.insertText(character);
          },
          { discrete: true },
        );
        await Promise.resolve();
      }
      editor.read(() => expect(exportLexicalToMarkdown($getRoot())).toBe("> New quote"));
    }
  });

  test("deleting a backward selection of the document starts a plain paragraph", () => {
    const editor = createEditor("> Quote");
    editor.update(
      () => {
        const selection = $selectAll();
        const { anchor, focus } = selection.clone();
        selection.anchor.set(focus.key, focus.offset, focus.type);
        selection.focus.set(anchor.key, anchor.offset, anchor.type);
        editor.dispatchCommand(REMOVE_TEXT_COMMAND, undefined);
      },
      { discrete: true },
    );
    editor.read(() =>
      expect(
        $getRoot()
          .getChildren()
          .map((node) => node.getType()),
      ).toEqual(["paragraph"]),
    );
  });

  test("deleting only the quote text preserves the other content and quote context", () => {
    const editor = createEditor("> Quote\n\nFollowing text");
    editor.update(
      () => {
        const text = $getRoot().getFirstDescendant();
        if (!$isTextNode(text)) throw new Error("Expected quoted text");
        text.select(0, text.getTextContentSize());
        editor.dispatchCommand(DELETE_CHARACTER_COMMAND, true);
      },
      { discrete: true },
    );
    editor.read(() => {
      expect(
        $getRoot()
          .getChildren()
          .map((node) => node.getType()),
      ).toEqual(["quote", "paragraph"]);
      expect($getRoot().getLastChild()?.getTextContent()).toBe("Following text");
    });
  });
});
