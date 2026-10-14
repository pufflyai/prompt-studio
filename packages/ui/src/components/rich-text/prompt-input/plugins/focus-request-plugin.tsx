import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalEditable } from "@lexical/react/useLexicalEditable";
import { useLayoutEffect } from "react";

/** Focus the editor once a request is pending and the editor is editable, then report completion. */
export const FocusRequestPlugin = (props: { requested: boolean; isEditable: boolean; onComplete?: () => void }) => {
  const { requested, isEditable, onComplete } = props;
  const [editor] = useLexicalComposerContext();
  // `isEditable` is the intended state. Lexical renders the DOM attribute in the same commit as
  // `rendered`, so both are true only when the browser can focus the editor and it stays unlocked.
  const rendered = useLexicalEditable();

  useLayoutEffect(() => {
    if (!requested || !isEditable || !rendered) return;
    const root = editor.getRootElement();
    const active = document.activeElement;
    // A request can wait while the editor is locked. Keep focus in a field or embedded view the person chose.
    const typingElsewhere =
      active instanceof HTMLElement &&
      !root?.contains(active) &&
      (active.isContentEditable || active.matches("input, textarea, select, iframe"));
    if (!typingElsewhere) root?.focus();
    onComplete?.();
  }, [requested, isEditable, rendered, editor, onComplete]);

  return null;
};
