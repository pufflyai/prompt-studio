import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createRangeSelectionFromDom, $getRoot } from "lexical";
import { createContext, type ReactNode, type RefObject, useContext, useEffect, useRef } from "react";
import type { MarkdownDocumentBinding } from "../shared/markdown-document-context";
import type { MarkdownSourceDocument } from "../shared/markdown-source-document";
import { createMarkdownSourcePoints } from "../shared/markdown-source-points";
import { paintMarkdownRanges, revealMarkdownRange } from "./plugins/markdown-find-ranges";
import {
  captureMarkdownSelectionAnchor,
  type MarkdownSelectionAnchor,
  resolveMarkdownSelectionAnchor,
} from "./plugins/markdown-selection-anchor";
import type { MarkdownSourceSelection } from "./plugins/markdown-source-selection-plugin";

export interface MarkdownEditorSelection extends MarkdownSourceSelection {
  text: string;
  rect: DOMRect;
  anchor?: MarkdownSelectionAnchor;
}
export interface MarkdownEditorExtensionContext {
  /** Capture before moving focus to an extension's UI. */
  captureSelection(): MarkdownEditorSelection | undefined;
  /** Reveal a durable source anchor without changing Markdown. */
  reveal(anchor: MarkdownSelectionAnchor): boolean;
  clearHighlight(): void;
  focus(): void;
}
const Context = createContext<MarkdownEditorExtensionContext | null>(null);
export const useMarkdownEditor = () => {
  const value = useContext(Context);
  if (!value) throw new Error("Markdown editor extensions must be rendered inside MarkdownEditor.");
  return value;
};
export const MarkdownEditorProvider = (props: {
  source: MarkdownSourceDocument;
  frontmatter: string;
  bindingRef: RefObject<MarkdownDocumentBinding | null>;
  children: ReactNode;
}) => {
  const { source, frontmatter, bindingRef, children } = props;
  const [editor] = useLexicalComposerContext();
  const highlight = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => highlight.current?.(), []);
  const clearHighlight = () => {
    highlight.current?.();
    highlight.current = undefined;
  };
  const captureSelection = () => {
    const root = editor.getRootElement();
    const selection = root?.ownerDocument.getSelection();
    if (
      !root ||
      !selection ||
      selection.isCollapsed ||
      !root.contains(selection.anchorNode) ||
      !root.contains(selection.focusNode)
    )
      return;
    const text = selection.toString();
    if (!text.trim() || text.length > 10000 || !selection.rangeCount) return;
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    const binding = bindingRef.current;
    const anchor = binding ? captureMarkdownSelectionAnchor(editor, binding) : undefined;
    return editor.getEditorState().read(
      () => {
        const range = $createRangeSelectionFromDom(selection, editor);
        if (!range || range.isCollapsed()) return;
        const body = source.exportFromLexical($getRoot());
        const points = createMarkdownSourcePoints($getRoot(), body);
        const first = points.toSource(range.anchor),
          last = points.toSource(range.focus);
        const position = (offset: number) => {
          const rows = (frontmatter + body.slice(0, offset)).split("\n");
          return { line: rows.length, column: rows.at(-1)!.length + 1 };
        };
        return { text, rect, anchor, start: position(Math.min(first, last)), end: position(Math.max(first, last)) };
      },
      { editor },
    );
  };
  return (
    <Context.Provider
      value={{
        captureSelection,
        clearHighlight,
        focus() {
          if (editor.isEditable()) editor.focus();
          else editor.getRootElement()?.focus({ preventScroll: true });
        },
        reveal(anchor) {
          clearHighlight();
          const binding = bindingRef.current;
          const range = binding && resolveMarkdownSelectionAnchor(editor, binding, anchor);
          if (!range) return false;
          revealMarkdownRange(range);
          highlight.current = paintMarkdownRanges("markdown-annotation", [range], 2);
          return true;
        },
      }}
    >
      {children}
    </Context.Provider>
  );
};
