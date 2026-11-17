import type { WebviewKeyboardEventParams } from "pstdio-api-contracts";
import { hasLocalKeyboardOwner, isEditableKeyboardTarget } from "./keyboard-owner";

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
      // Negotiated global chords already ran. Native input shortcuts stay local, including shifted redo.
      if (isEditableKeyboardTarget(event.target)) return;
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
