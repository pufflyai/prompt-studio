import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLayoutEffect } from "react";

export default function ToggleEditablePlugin({ isEditable }: { isEditable: boolean }) {
  const [editor] = useLexicalComposerContext();

  // Settle the editable DOM before the host's next-frame focus handoff.
  useLayoutEffect(() => {
    editor.setEditable(isEditable);
  }, [isEditable, editor]);

  return null;
}
