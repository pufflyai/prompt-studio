import { $isMarkNode, $unwrapMarkNode, $wrapSelectionInMarkNode, MarkNode } from "@lexical/mark";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createRangeSelection,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_HIGH,
  KEY_DOWN_COMMAND,
  type LexicalEditor,
  SKIP_DOM_SELECTION_TAG,
  SKIP_SCROLL_INTO_VIEW_TAG,
} from "lexical";
import { useEffect } from "react";
import type { ReviewThread } from "./review-fixtures";
import { findQuote } from "./review-text";

interface ReviewPluginProps {
  threads: ReviewThread[];
  showResolved: boolean;
  onSelect: (quote: string) => void;
  onOpen: (id: string) => void;
  onReady: (editor: LexicalEditor) => void;
  onTextChange: (text: string) => void;
}

export function selectComment(editor: LexicalEditor, onSelect: (quote: string) => void) {
  editor.getEditorState().read(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection) && !selection.isCollapsed()) {
      const quote = selection.getTextContent().trim();
      if (quote) onSelect(quote);
    }
  });
}

function markThread(thread: Pick<ReviewThread, "id" | "quote" | "resolved">) {
  if (!thread.quote) return;
  const nodes = $getRoot().getAllTextNodes();
  const content = $getRoot().getTextContent();
  const match = findQuote(content, thread.quote);
  if (!match) return;
  const { start, end } = match;
  let offset = 0;
  const selection = $createRangeSelection();
  for (const node of nodes) {
    offset = content.indexOf(node.getTextContent(), offset);
    const next = offset + node.getTextContentSize();
    if (start >= offset && start < next) selection.anchor.set(node.getKey(), start - offset, "text");
    if (end > offset && end <= next) selection.focus.set(node.getKey(), end - offset, "text");
    offset = next;
  }
  $setSelection(selection);
  $wrapSelectionInMarkNode(selection, false, thread.id);
}

export function ReviewPlugin(props: ReviewPluginProps) {
  const { threads, showResolved, onSelect, onOpen, onReady, onTextChange } = props;
  const [editor] = useLexicalComposerContext();
  const markers = JSON.stringify(threads.map(({ id, quote, resolved }) => ({ id, quote, resolved })));

  useEffect(() => {
    onReady(editor);
  }, [editor, onReady]);

  useEffect(
    () =>
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "m") {
            event.preventDefault();
            selectComment(editor, onSelect);
            return true;
          }
          return false;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor, onSelect],
  );

  useEffect(() => {
    editor.getEditorState().read(() => onTextChange($getRoot().getTextContent()));
    return editor.registerTextContentListener(onTextChange);
  }, [editor, onTextChange]);

  useEffect(() => {
    // This study matches quotes for display only. Production needs persisted range/context anchors.
    editor.update(
      () => {
        const saved = $getSelection()?.clone() ?? null;
        for (const node of $getRoot().getAllTextNodes()) {
          const parent = node.getParent();
          if ($isMarkNode(parent)) $unwrapMarkNode(parent);
        }
        const values: Pick<ReviewThread, "id" | "quote" | "resolved">[] = JSON.parse(markers);
        for (const thread of values.filter((item) => !item.resolved || showResolved)) markThread(thread);
        $setSelection(saved);
      },
      { tag: ["review-markers", SKIP_DOM_SELECTION_TAG, SKIP_SCROLL_INTO_VIEW_TAG] },
    );
  }, [editor, markers, showResolved]);

  useEffect(() => {
    const decorate = () => {
      editor.getEditorState().read(() => {
        for (const node of $getRoot().getAllTextNodes()) {
          const parent = node.getParent();
          if (!$isMarkNode(parent)) continue;
          const element = editor.getElementByKey(parent.getKey());
          if (!element) continue;
          const id = parent.getIDs()[0];
          element.dataset.reviewThread = id;
          element.setAttribute("role", "button");
          element.setAttribute("tabindex", "0");
          element.setAttribute("aria-label", `Open comment: ${parent.getTextContent()}`);
        }
      });
    };
    const unregister = editor.registerMutationListener(MarkNode, decorate);
    return unregister;
  }, [editor]);

  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;
    const open = (event: MouseEvent | KeyboardEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const id = target.closest<HTMLElement>("[data-review-thread]")?.dataset.reviewThread;
      if (!id) return;
      if (event instanceof KeyboardEvent && event.key !== "Enter" && event.key !== " ") return;
      if (event instanceof KeyboardEvent) event.preventDefault();
      onOpen(id);
    };
    root.addEventListener("click", open);
    root.addEventListener("keydown", open);
    return () => {
      root.removeEventListener("click", open);
      root.removeEventListener("keydown", open);
    };
  }, [editor, onOpen]);
  return null;
}
