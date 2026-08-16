import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { COMMAND_PRIORITY_HIGH, KEY_DOWN_COMMAND, REDO_COMMAND, UNDO_COMMAND } from "lexical";
import { useEffect, useState } from "react";

export const MarkdownHistoryPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const [historyState] = useState(() => ({
    current: { editor, editorState: editor.getEditorState() },
    redoStack: [],
    undoStack: [],
  }));

  useEffect(() => {
    historyState.current = { editor, editorState: editor.getEditorState() };
  }, [editor, historyState]);

  useEffect(
    () =>
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          const target = event.target;
          if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return false;
          if ((!event.ctrlKey && !event.metaKey) || event.key.toLowerCase() !== "z") return false;

          event.preventDefault();
          editor.dispatchCommand(event.shiftKey ? REDO_COMMAND : UNDO_COMMAND, undefined);
          return true;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    [editor],
  );

  return <HistoryPlugin externalHistoryState={historyState} />;
};
