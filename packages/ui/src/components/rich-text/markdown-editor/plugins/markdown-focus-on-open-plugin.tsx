import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { useEffect, useRef } from "react";

export const MarkdownFocusOnOpenPlugin = (props: { shouldFocus: (root: HTMLElement) => boolean }) => {
  const { shouldFocus } = props;
  const [editor] = useLexicalComposerContext();
  const editable = useLexicalEditable();
  const attempted = useRef(false);

  useEffect(() => {
    if (!editable || attempted.current) return;
    const root = editor.getRootElement();
    if (!root) return;
    // An update or reconnect must not take focus after the first editable render.
    attempted.current = true;
    if (shouldFocus(root)) root.focus({ preventScroll: true });
  }, [editable, editor, shouldFocus]);

  return null;
};
