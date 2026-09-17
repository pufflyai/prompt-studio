import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { COMMAND_PRIORITY_HIGH, KEY_DOWN_COMMAND } from "lexical";
import { useEffect } from "react";
import { shouldRecallNext, shouldRecallPrevious, shouldSubmitOnEnter } from "./keyboard-shortcuts";

export interface KeyboardShortcutPluginProps {
  onSubmit?: () => void;
  onRecallPrevious?: () => boolean;
  onRecallNext?: () => boolean;
}

export function KeyboardShortcutPlugin(props: KeyboardShortcutPluginProps) {
  const { onSubmit, onRecallPrevious, onRecallNext } = props;
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
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
