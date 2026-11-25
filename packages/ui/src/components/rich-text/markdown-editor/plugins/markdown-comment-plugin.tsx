import { Button } from "@chakra-ui/react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { type RefObject, useEffect, useRef, useState } from "react";
import type { MarkdownDocumentBinding } from "../../shared/markdown-document-context";
import { captureMarkdownPassage, type MarkdownPassage, resolveMarkdownPassage } from "./markdown-comment-anchor";
import { paintMarkdownRanges, revealMarkdownRange } from "./markdown-find-ranges";

export interface MarkdownCommentActions {
  comment(passage: MarkdownPassage & { quote: string }): void;
  registerReveal(reveal: (passage: MarkdownPassage) => boolean): () => void;
}
export const MarkdownCommentPlugin = (props: {
  bindingRef: RefObject<MarkdownDocumentBinding | null>;
  actions: MarkdownCommentActions;
}) => {
  const { bindingRef, actions } = props;
  const { registerReveal, comment } = actions;
  const [editor] = useLexicalComposerContext();
  const [selected, setSelected] = useState(false);
  const stopHighlight = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    const selectionChanged = () => {
      const root = editor.getRootElement();
      const selection = root?.ownerDocument.getSelection();
      setSelected(
        Boolean(
          bindingRef.current &&
            selection &&
            !selection.isCollapsed &&
            root?.contains(selection.anchorNode) &&
            root.contains(selection.focusNode),
        ),
      );
    };
    document.addEventListener("selectionchange", selectionChanged);
    return () => document.removeEventListener("selectionchange", selectionChanged);
  }, [editor, bindingRef]);

  useEffect(() => {
    const stop = registerReveal((passage) => {
      stopHighlight.current?.();
      const binding = bindingRef.current;
      const range = binding && resolveMarkdownPassage(editor, binding, passage);
      if (!range) return false;
      revealMarkdownRange(range);
      stopHighlight.current = paintMarkdownRanges("markdown-comment", [range], 2);
      return true;
    });
    return () => {
      stop();
      stopHighlight.current?.();
    };
  }, [editor, bindingRef, registerReveal]);

  const start = () => {
    const binding = bindingRef.current;
    const passage = binding && captureMarkdownPassage(editor, binding);
    if (passage) comment(passage);
  };
  return (
    <Button
      size="xs"
      variant="outline"
      position="absolute"
      top="xs"
      insetInlineEnd="md"
      zIndex="docked"
      display={selected ? undefined : "none"}
      onMouseDown={(event) => event.preventDefault()}
      onClick={start}
    >
      Comment
    </Button>
  );
};
