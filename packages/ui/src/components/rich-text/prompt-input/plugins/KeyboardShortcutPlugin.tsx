import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  COMMAND_PRIORITY_HIGH,
  INSERT_LINE_BREAK_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  KEY_DOWN_COMMAND,
  type LexicalEditor,
} from "lexical";
import { useEffect } from "react";
import { shouldRecallNext, shouldRecallPrevious, shouldSubmitOnEnter } from "./keyboard-shortcuts";

export interface KeyboardShortcutPluginProps {
  onSubmit?: () => void;
  onRecallPrevious?: () => boolean;
  onRecallNext?: () => boolean;
}

const insertModifiedEnter = (editor: LexicalEditor, event: KeyboardEvent) => {
  event.preventDefault();
  if (event.shiftKey) editor.dispatchCommand(INSERT_LINE_BREAK_COMMAND, false);
  else editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
};

export function KeyboardShortcutPlugin(props: KeyboardShortcutPluginProps) {
  const { onSubmit, onRecallPrevious, onRecallNext } = props;
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        // The editor's typeahead menu owns Enter, Tab, and arrow keys while it is open.
        if (editor.getRootElement()?.hasAttribute("aria-controls")) {
          if (event.key === "Enter" && !shouldSubmitOnEnter(event)) {
            insertModifiedEnter(editor, event);
            return true;
          }
          return false;
        }
        if (shouldSubmitOnEnter(event)) {
          event.preventDefault();
          onSubmit?.();
          return true;
        }

        if ((shouldRecallPrevious(event) && onRecallPrevious?.()) || (shouldRecallNext(event) && onRecallNext?.())) {
          event.preventDefault();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor, onSubmit, onRecallPrevious, onRecallNext]);

  return null;
}
