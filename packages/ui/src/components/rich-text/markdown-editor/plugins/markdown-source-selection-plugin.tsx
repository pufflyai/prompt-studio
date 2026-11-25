import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createRangeSelectionFromDom, $getRoot } from "lexical";
import { useEffect, useEffectEvent } from "react";
import type { MarkdownSourceDocument } from "../../shared/markdown-source-document";
import { createMarkdownSourcePoints } from "../../shared/markdown-source-points";

export interface MarkdownSourceSelection {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

export const MarkdownSourceSelectionPlugin = (props: {
  source: MarkdownSourceDocument;
  frontmatter: string;
  onSelection(selection: MarkdownSourceSelection | null): void;
}) => {
  const { source, frontmatter, onSelection } = props;
  const [editor] = useLexicalComposerContext();
  const observe = useEffectEvent(() => {
    const root = editor.getRootElement();
    const selection = root?.ownerDocument.getSelection();
    // Focus can move to the composer without dismissing the document subject.
    if (!root || !selection || !root.contains(selection.anchorNode) || !root.contains(selection.focusNode)) return;
    if (selection.isCollapsed) return onSelection(null);
    editor.getEditorState().read(() => {
      const range = $createRangeSelectionFromDom(selection, editor);
      if (!range || range.isCollapsed()) return;
      const body = source.exportFromLexical($getRoot());
      const points = createMarkdownSourcePoints($getRoot(), body);
      const first = points.toSource(range.anchor);
      const last = points.toSource(range.focus);
      const position = (offset: number) => {
        const rows = (frontmatter + body.slice(0, offset)).split("\n");
        return { line: rows.length, column: rows.at(-1)!.length + 1 };
      };
      onSelection({ start: position(Math.min(first, last)), end: position(Math.max(first, last)) });
    });
  });
  useEffect(() => {
    const root = editor.getRootElement();
    const doc = root?.ownerDocument ?? document;
    const changed = () => observe();
    doc.addEventListener("selectionchange", changed);
    const stop = editor.registerUpdateListener(({ dirtyElements, dirtyLeaves }) => {
      if (dirtyElements.size || dirtyLeaves.size) changed();
    });
    return () => {
      stop();
      doc.removeEventListener("selectionchange", changed);
    };
  }, [editor]);
  return null;
};
