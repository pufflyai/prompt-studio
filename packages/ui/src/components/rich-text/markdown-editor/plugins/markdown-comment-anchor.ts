import { createDOMRange } from "@lexical/selection";
import { $createRangeSelectionFromDom, $getNodeByKey, $getRoot, type LexicalEditor } from "lexical";
import * as Y from "yjs";
import type { MarkdownDocumentBinding } from "../../shared/markdown-document-context";
import { createMarkdownSourcePoints } from "../../shared/markdown-source-points";
import { splitFrontmatter } from "../../utils/markdown";

export interface MarkdownPassage {
  start: string;
  end: string;
}
const encode = (position: Y.RelativePosition) => btoa(String.fromCharCode(...Y.encodeRelativePosition(position)));
const decode = (position: string) => Y.decodeRelativePosition(Uint8Array.from(atob(position), (c) => c.charCodeAt(0)));

export const captureMarkdownPassage = (editor: LexicalEditor, binding: MarkdownDocumentBinding) => {
  const root = editor.getRootElement();
  const selection = root?.ownerDocument.getSelection();
  if (
    !root ||
    !selection ||
    selection.isCollapsed ||
    !root.contains(selection.anchorNode) ||
    !root.contains(selection.focusNode) ||
    !binding.text.doc
  )
    return;
  return editor.getEditorState().read(() => {
    const range = $createRangeSelectionFromDom(selection, editor);
    if (!range || range.isCollapsed()) return;
    const quote = selection.toString();
    if (!quote.trim() || quote.length > 10000) return;
    const text = binding.text;
    const { body, frontmatter } = splitFrontmatter(text.toString());
    const points = createMarkdownSourcePoints($getRoot(), body);
    const anchor = frontmatter.length + points.toSource(range.anchor);
    const focus = frontmatter.length + points.toSource(range.focus);
    const first = Math.min(anchor, focus);
    const last = Math.max(anchor, focus);
    if (first === last) return;
    return {
      quote,
      start: encode(Y.createRelativePositionFromTypeIndex(text, first, 0)),
      end: encode(Y.createRelativePositionFromTypeIndex(text, last, -1)),
    };
  });
};

export const resolveMarkdownPassage = (
  editor: LexicalEditor,
  binding: MarkdownDocumentBinding,
  passage: MarkdownPassage,
) => {
  const text = binding.text;
  if (!text.doc) return;
  try {
    const start = Y.createAbsolutePositionFromRelativePosition(decode(passage.start), text.doc);
    const end = Y.createAbsolutePositionFromRelativePosition(decode(passage.end), text.doc);
    if (!start || !end || start.type !== text || end.type !== text || start.index >= end.index) return;
    const { frontmatter, body } = splitFrontmatter(text.toString());
    if (start.index < frontmatter.length) return;
    return editor.getEditorState().read(() => {
      const points = createMarkdownSourcePoints($getRoot(), body);
      const from = points.toPoint(start.index - frontmatter.length);
      const to = points.toPoint(end.index - frontmatter.length);
      const first = $getNodeByKey(from.key);
      const last = $getNodeByKey(to.key);
      if (first && last) {
        const range = createDOMRange(editor, first, from.offset, last, to.offset);
        if (range && !range.collapsed) return range;
      }
    });
  } catch {
    return;
  }
};
