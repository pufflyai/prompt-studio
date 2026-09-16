import { describe, expect, test } from "bun:test";
import { $createQuoteNode } from "@lexical/rich-text";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  createEditor,
  KEY_ENTER_COMMAND,
} from "lexical";
import { editorNodes } from "../../shared/editor-config";
import { registerQuoteExitShortcut } from "./quote-exit-shortcut";

const createHeadlessEditor = () => createEditor({ nodes: editorNodes });

describe("quote exit shortcut", () => {
  test.each([false, true])("Shift+Enter moves the cursor after the quote (nested child: %s)", (nested) => {
    const editor = createHeadlessEditor();
    const unregister = registerQuoteExitShortcut(editor);

    editor.update(
      () => {
        const quote = $createQuoteNode();
        const text = $createTextNode("Quoted text");
        quote.append(nested ? $createParagraphNode().append(text) : text);
        $getRoot().append(quote, $createParagraphNode().append($createTextNode("Following text")));
        text.select(3, 3);
      },
      { discrete: true },
    );

    let wasPrevented = false;
    const event = {
      shiftKey: true,
      preventDefault: () => {
        wasPrevented = true;
      },
    } as KeyboardEvent;
    let handled = false;
    editor.update(
      () => {
        handled = editor.dispatchCommand(KEY_ENTER_COMMAND, event);
      },
      { discrete: true },
    );

    expect(handled).toBe(true);
    expect(wasPrevented).toBe(true);
    editor.getEditorState().read(() => {
      const rootChildren = $getRoot().getChildren();
      expect(rootChildren.map((node) => node.getType())).toEqual(["quote", "paragraph", "paragraph"]);
      expect(rootChildren[0]?.getTextContent()).toBe("Quoted text");
      expect(rootChildren[2]?.getTextContent()).toBe("Following text");
      const selection = $getSelection();
      expect($isRangeSelection(selection)).toBe(true);
      if (!$isRangeSelection(selection)) throw new Error("Expected a range selection");
      expect(selection.isCollapsed()).toBe(true);
      expect(selection.anchor.getNode()).toBe(rootChildren[1]);
      expect(selection.anchor.offset).toBe(0);
    });

    unregister();
  });

  test("does not handle Enter without Shift", () => {
    const editor = createHeadlessEditor();
    const unregister = registerQuoteExitShortcut(editor);

    editor.update(
      () => {
        const quote = $createQuoteNode().append($createTextNode("Quoted text"));
        $getRoot().append(quote);
        quote.selectEnd();
      },
      { discrete: true },
    );

    let handled = true;
    editor.update(
      () => {
        handled = editor.dispatchCommand(KEY_ENTER_COMMAND, { shiftKey: false } as KeyboardEvent);
      },
      { discrete: true },
    );

    expect(handled).toBe(false);
    unregister();
  });

  test.each(["paragraph", "expanded quote selection"])("preserves Shift+Enter behavior for %s", (context) => {
    const editor = createHeadlessEditor();
    const unregister = registerQuoteExitShortcut(editor);
    editor.update(
      () => {
        const text = $createTextNode("Existing text");
        const block = context === "paragraph" ? $createParagraphNode() : $createQuoteNode();
        $getRoot().append(block.append(text));
        text.select(0, context === "paragraph" ? 0 : 5);
        const event = {
          shiftKey: true,
          preventDefault: () => {
            throw new Error("Default behavior must remain available");
          },
        } as KeyboardEvent;
        expect(editor.dispatchCommand(KEY_ENTER_COMMAND, event)).toBe(false);
        expect($getRoot().getChildrenSize()).toBe(1);
        expect(block.getTextContent()).toBe("Existing text");
      },
      { discrete: true },
    );
    unregister();
  });
});
