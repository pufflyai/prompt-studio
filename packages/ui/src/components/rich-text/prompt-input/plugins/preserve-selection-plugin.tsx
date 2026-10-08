import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createRangeSelection,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  type LexicalNode,
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

export interface PromptSelectionSnapshot {
  anchor: { path: number[]; offset: number; type: "text" | "element" };
  focus: { path: number[]; offset: number; type: "text" | "element" };
}
const pointSnapshot = (point: PointType) => {
  const path: number[] = [];
  let node = $getNodeByKey(point.key);
  while (node?.getParent()) {
    path.unshift(node.getIndexWithinParent());
    node = node.getParent();
  }
  return { path, offset: point.offset, type: point.type };
};
const restorePoint = (saved: PromptSelectionSnapshot["anchor"]) => {
  let node: LexicalNode | undefined = $getRoot();
  for (const index of saved.path) node = $isElementNode(node) ? (node.getChildAtIndex(index) ?? undefined) : undefined;
  return node ? { key: node.getKey(), offset: saved.offset, type: saved.type } : undefined;
};

/** Keep the last editing range when a temporarily disabled editor loses DOM selection. */
export const PreserveSelectionPlugin = (props: {
  isEditable: boolean;
  initialSelection?: PromptSelectionSnapshot;
  onSelectionChange?: (selection: PromptSelectionSnapshot) => void;
}) => {
  const { isEditable, initialSelection, onSelectionChange } = props;
  const initial = useRef(initialSelection);
  const changed = useRef(onSelectionChange);
  changed.current = onSelectionChange;
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
          if ($isRangeSelection(current)) {
            selection.current = current.clone();
            changed.current?.({ anchor: pointSnapshot(current.anchor), focus: pointSnapshot(current.focus) });
          }
        });
      }),
    [editor],
  );
  useLayoutEffect(() => {
    if (!isEditable) return;
    const root = editor.getRootElement();
    if (!root || root.contains(document.activeElement) || (!selection.current && !initial.current)) return;
    // Restore on return even when another control had focus before takeover. Flush during native focus
    // so a later click or select-all can choose its own range without a deferred restore overwriting it.
    const restoreSelection = () => {
      editor.update(
        () => {
          if (!selection.current && initial.current) {
            const anchor = restorePoint(initial.current.anchor);
            const focus = restorePoint(initial.current.focus);
            if (anchor && focus) {
              const range = $createRangeSelection();
              range.anchor.set(anchor.key, anchor.offset, anchor.type);
              range.focus.set(focus.key, focus.offset, focus.type);
              selection.current = range;
            }
            initial.current = undefined;
          }
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
