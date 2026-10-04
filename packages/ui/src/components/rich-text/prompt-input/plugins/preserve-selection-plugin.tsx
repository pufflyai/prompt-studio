import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getNodeByKey,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
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
  const editing = useRef(isEditable);
  editing.current = isEditable;
  useLayoutEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const saved = selection.current;
          if (saved && (!validPoint(saved.anchor) || !validPoint(saved.focus))) selection.current = null;
          if (!editing.current) return;
          const current = $getSelection();
          if ($isRangeSelection(current)) selection.current = current.clone();
        });
      }),
    [editor],
  );
  useLayoutEffect(() => {
    if (!isEditable) return;
    const root = editor.getRootElement();
    if (!root || root.contains(document.activeElement) || !selection.current) return;
    // Restore on return even when another control had focus before takeover. Flush during native focus
    // so a later click or select-all can choose its own range without a deferred restore overwriting it.
    const restoreSelection = () => {
      editor.update(
        () => {
          const saved = selection.current;
          if (saved && validPoint(saved.anchor) && validPoint(saved.focus)) $setSelection(saved.clone());
        },
        { discrete: true },
      );
    };
    root.addEventListener("focus", restoreSelection, { once: true });
    return () => root.removeEventListener("focus", restoreSelection);
  }, [editor, isEditable]);
  return null;
};
