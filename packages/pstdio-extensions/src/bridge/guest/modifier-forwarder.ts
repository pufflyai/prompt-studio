import type { WebviewKeyboardEventParams } from "pstdio-api-contracts";
import { hasLocalKeyboardOwner } from "./keyboard-owner";

/** Compatibility for unclaimed direct chords; local handlers finish before forwarding. */
export const installModifierForwarder = (
  target: Document,
  dispatch: (event: WebviewKeyboardEventParams) => Promise<void>,
) => {
  target.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" ||
        event.isComposing ||
        event.getModifierState("AltGraph") ||
        hasLocalKeyboardOwner(target)
      )
        return;
      if (!event.ctrlKey && !event.metaKey && !event.altKey) return;
      const editable =
        event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable="true"]');
      if (editable && !event.shiftKey) return;
      setTimeout(() => {
        if (event.defaultPrevented) return;
        void dispatch({
          key: event.key,
          code: event.code,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          shiftKey: event.shiftKey,
          repeat: event.repeat,
          isComposing: event.isComposing,
        }).catch(() => {});
      }, 0);
    },
    true,
  );
};
