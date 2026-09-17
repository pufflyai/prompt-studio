import { mergeRegister } from "@lexical/utils";
import {
  $createParagraphNode,
  $createRangeSelection,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $normalizeSelection__EXPERIMENTAL,
  $setSelection,
  COMMAND_PRIORITY_HIGH,
  DELETE_CHARACTER_COMMAND,
  DELETE_LINE_COMMAND,
  DELETE_WORD_COMMAND,
  type LexicalEditor,
  REMOVE_TEXT_COMMAND,
} from "lexical";

function $clearFullDocumentSelection() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || selection.isCollapsed()) return false;

  const normalized = $normalizeSelection__EXPERIMENTAL(selection.clone());
  const root = $getRoot();
  const entireDocument = selection.clone();
  entireDocument.anchor.set(root.getKey(), 0, "element");
  entireDocument.focus.set(root.getKey(), root.getChildrenSize(), "element");
  $normalizeSelection__EXPERIMENTAL(entireDocument);
  const [start, end] = normalized.isBackward()
    ? [normalized.focus, normalized.anchor]
    : [normalized.anchor, normalized.focus];
  if (!start.is(entireDocument.anchor) || !end.is(entireDocument.focus)) return false;

  // Range deletion otherwise retains the first block's quote, heading, or text format.
  $setSelection($createRangeSelection());
  root.clear().append($createParagraphNode()).selectStart();
  return true;
}

export function registerClearEditorSelection(editor: LexicalEditor) {
  return mergeRegister(
    editor.registerCommand(DELETE_CHARACTER_COMMAND, $clearFullDocumentSelection, COMMAND_PRIORITY_HIGH),
    editor.registerCommand(DELETE_WORD_COMMAND, $clearFullDocumentSelection, COMMAND_PRIORITY_HIGH),
    editor.registerCommand(DELETE_LINE_COMMAND, $clearFullDocumentSelection, COMMAND_PRIORITY_HIGH),
    editor.registerCommand(REMOVE_TEXT_COMMAND, $clearFullDocumentSelection, COMMAND_PRIORITY_HIGH),
  );
}
