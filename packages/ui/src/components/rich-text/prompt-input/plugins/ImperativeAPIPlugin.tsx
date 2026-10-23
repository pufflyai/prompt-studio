import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot } from "lexical";
import { useImperativeHandle } from "react";
import { generateEditorStateFromString } from "../utils";

export interface PromptEditorRef {
  /** Replace text and report it through onChange with its matching editor state. */
  setEditorValue: (value: string) => void;
}

export function ImperativeAPIPlugin({ editorRef }: { editorRef: React.ForwardedRef<PromptEditorRef> }) {
  const [editor] = useLexicalComposerContext();

  useImperativeHandle(
    editorRef,
    () => ({
      setEditorValue: (value: string) => {
        // Keep text and selection in one state when replacement runs inside a key command.
        const state = editor.parseEditorState(JSON.stringify(generateEditorStateFromString(value)), () => {
          $getRoot().selectEnd();
        });
        editor.setEditorState(state);
        editor.focus();
      },
    }),
    [editor],
  );

  return null;
}
