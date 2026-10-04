import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getNodeByKey,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_LOW,
  FOCUS_COMMAND,
  type PointType,
  type RangeSelection,
} from "lexical";
import { useLayoutEffect, useRef } from "react";

const validPoint = (point: PointType) => {
  const node = $getNodeByKey(point.key);
  if (!node?.isAttached()) return false;
  if (point.type === "text") return $isTextNode(node) && point.offset <= node.getTextContentSize();
  return $isElementNode(node) && point.offset <= node.getChildrenSize();
};

/** Keep the last editing range when a temporarily disabled editor loses DOM selection. */
export const PreserveSelectionPlugin = (props: { isEditable: boolean }) => {
  const { isEditable } = props;
  const [editor] = useLexicalComposerContext();
  const selection = useRef<RangeSelection | null>(null);
  const editing = useRef({ editable: isEditable, restoreFocus: false });
  if (editing.current.editable && !isEditable) {
    // Read focus before the commit hides the draft. A send-button blur already happened earlier.
    editing.current.restoreFocus = editor.getRootElement()?.contains(document.activeElement) ?? false;
  }
  editing.current.editable = isEditable;
  useLayoutEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const saved = selection.current;
          if (saved && (!validPoint(saved.anchor) || !validPoint(saved.focus))) selection.current = null;
          if (!editing.current.editable) return;
          const current = $getSelection();
          if ($isRangeSelection(current)) selection.current = current.clone();
        });
      }),
    [editor],
  );
  useLayoutEffect(() => {
    if (!isEditable) return;
    if (!editing.current.restoreFocus || editor.getRootElement()?.contains(document.activeElement)) return;
    let unregisterFocus = () => {};
    if (selection.current) {
      unregisterFocus = editor.registerCommand(
        FOCUS_COMMAND,
        () => {
          unregisterFocus();
          editing.current.restoreFocus = false;
          if (selection.current) $setSelection(selection.current.clone());
          return false;
        },
        COMMAND_PRIORITY_LOW,
      );
    }
    return () => unregisterFocus();
  }, [editor, isEditable]);
  return null;
};
