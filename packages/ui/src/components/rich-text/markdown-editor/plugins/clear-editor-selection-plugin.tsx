import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";
import { registerClearEditorSelection } from "./clear-editor-selection";

export function ClearEditorSelectionPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => registerClearEditorSelection(editor), [editor]);

  return null;
}
