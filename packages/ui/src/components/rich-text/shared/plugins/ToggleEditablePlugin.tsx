import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLayoutEffect } from "react";

export default function ToggleEditablePlugin({ isEditable }: { isEditable: boolean }) {
  const [editor] = useLexicalComposerContext();

  // Apply the change in the same task as the commit, so no input lands in an editor that was just locked.
  useLayoutEffect(() => {
    editor.setEditable(isEditable);
  }, [isEditable, editor]);

  return null;
}
