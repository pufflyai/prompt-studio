import { $isQuoteNode } from "@lexical/rich-text";
import { $findMatchingParent } from "@lexical/utils";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  KEY_ENTER_COMMAND,
  type LexicalEditor,
} from "lexical";

export function registerQuoteExitShortcut(editor: LexicalEditor) {
  return editor.registerCommand(
    KEY_ENTER_COMMAND,
    (event) => {
      if (!event?.shiftKey) return false;

      const selection = $getSelection();
      if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

      const quote = $findMatchingParent(selection.anchor.getNode(), $isQuoteNode);
      if (!quote) return false;

      event.preventDefault();
      quote.insertNewAfter(selection, false).selectStart();
      return true;
    },
    COMMAND_PRIORITY_HIGH,
  );
}
