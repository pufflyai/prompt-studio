import { describe, expect, test } from "bun:test";
import { registerMarkdownShortcuts } from "@lexical/markdown";
import { $createQuoteNode, registerRichText } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  DELETE_CHARACTER_COMMAND,
  KEY_ENTER_COMMAND,
  type LexicalEditor,
  SELECT_ALL_COMMAND,
} from "lexical";
import { exportLexicalToMarkdown, importMarkdownToLexical } from "./markdown-codec";
import { createHeadlessEditor, editorTransformers } from "./transformers/markdown-transformers-test-utils";

const insertText = (text: string) => {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) throw new Error("Expected a text cursor");
  selection.insertText(text);
};

const typeText = async (editor: LexicalEditor, text: string) => {
  for (const character of text) {
    editor.update(() => insertText(character), { discrete: true });
    await Promise.resolve();
  }
};

const pressEnter = (editor: LexicalEditor, shiftKey: boolean, text: string) => {
  editor.update(
    () => {
      editor.dispatchCommand(KEY_ENTER_COMMAND, { shiftKey, preventDefault() {} } as KeyboardEvent);
      insertText(text);
    },
    { discrete: true },
  );
};

const createQuote = async (source: string) => {
  const editor = createHeadlessEditor();
  registerRichText(editor);
  registerMarkdownShortcuts(editor, editorTransformers);
  editor.update(
    () => {
      importMarkdownToLexical(source === "loaded" ? "> First line" : "");
      $getRoot().selectEnd();
    },
    { discrete: true },
  );
  if (source === "typed") await typeText(editor, "> First line");
  if (source === "toolbar") {
    editor.update(
      () => {
        insertText("First line");
        $setBlocksType($getSelection(), $createQuoteNode);
      },
      { discrete: true },
    );
  }
  return editor;
};

describe("Markdown quote editing", () => {
  test.each(["loaded", "typed", "toolbar"])("Shift+Enter extends a %s quote and Enter leaves it", async (source) => {
    const editor = await createQuote(source);
    pressEnter(editor, true, "Second line");
    editor.read(() => {
      expect(
        $getRoot()
          .getChildren()
          .map((node) => node.getType()),
      ).toEqual(["quote"]);
      expect(exportLexicalToMarkdown($getRoot())).toBe("> First line\\\n> Second line");
    });
    pressEnter(editor, false, "Outside");
    editor.read(() => {
      expect(
        $getRoot()
          .getChildren()
          .map((node) => node.getType()),
      ).toEqual(["quote", "paragraph"]);
      expect(exportLexicalToMarkdown($getRoot())).toBe("> First line\\\n> Second line\n\nOutside");
    });
  });

  test("quotes retain formatting and line breaks after saving and reopening", async () => {
    const editor = await createQuote("toolbar");
    editor.update(
      () => {
        $getRoot().getAllTextNodes()[0]?.toggleFormat("bold");
      },
      { discrete: true },
    );
    pressEnter(editor, true, "Second line");
    const markdown = editor.read(() => exportLexicalToMarkdown($getRoot()));
    expect(markdown).toBe("> **First line**\\\n> Second line");
    editor.update(
      () => {
        importMarkdownToLexical(markdown);
        $getRoot().selectEnd();
      },
      { discrete: true },
    );
    pressEnter(editor, false, "Outside");
    editor.read(() => {
      expect(
        $getRoot()
          .getChildren()
          .map((node) => node.getType()),
      ).toEqual(["quote", "paragraph"]);
      expect(exportLexicalToMarkdown($getRoot())).toBe(`${markdown}\n\nOutside`);
    });
  });

  test("quote shortcuts work after selecting all and deleting a quote", async () => {
    const editor = await createQuote("loaded");
    for (let attempt = 0; attempt < 2; attempt++) {
      editor.update(
        () => {
          editor.dispatchCommand(SELECT_ALL_COMMAND, undefined);
          editor.dispatchCommand(DELETE_CHARACTER_COMMAND, true);
        },
        { discrete: true },
      );
      await typeText(editor, "> New quote");
      editor.read(() => expect(exportLexicalToMarkdown($getRoot())).toBe("> New quote"));
    }
  });
});
