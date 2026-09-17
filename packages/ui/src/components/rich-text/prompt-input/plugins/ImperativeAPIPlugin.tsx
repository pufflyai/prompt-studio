import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getRoot } from "lexical";
import { useImperativeHandle } from "react";
import { generateEditorStateFromString } from "../utils";

export interface PromptEditorRef {
  setEditorValue: (value: string) => void;
}

export function ImperativeAPIPlugin({
  editorRef,
  previousTextRef,
}: {
  editorRef: React.ForwardedRef<PromptEditorRef>;
  previousTextRef: React.MutableRefObject<string>;
}) {
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
        previousTextRef.current = value;
        editor.focus();
      },
    }),
    [editor, previousTextRef],
  );

  return null;
}
