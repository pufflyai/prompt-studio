import { useState } from "react";
import { getTextFromSerializedEditorState } from "../../rich-text";

// The editor's content and its plain text. A seed is not a user edit, so adopting the host's
// `defaultState` never reports a change. Text the editor already shows (the host echoing the
// user's own typing) keeps the mounted editor, its selection and its history.
export const useChatInputText = (defaultState: string) => {
  const [adoptedState, setAdoptedState] = useState(defaultState);
  const [editorState, setEditorState] = useState(defaultState);
  const [editorKey, setEditorKey] = useState(0);
  const [text, setText] = useState(() => getTextFromSerializedEditorState(defaultState));

  const remountEditor = (state: string) => {
    setEditorState(state);
    setEditorKey((key) => key + 1);
  };

  if (adoptedState !== defaultState) {
    setAdoptedState(defaultState);
    const nextText = getTextFromSerializedEditorState(defaultState);
    if (nextText !== text) {
      remountEditor(defaultState);
      setText(nextText);
    }
  }

  return { editorKey, editorState, remountEditor, setEditorState, setText, text };
};
