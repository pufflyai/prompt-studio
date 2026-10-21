import type { WebviewKeyboardEventParams } from "pstdio-api-contracts";

/** Guest dialogs and editors handle Escape before the host presentation does. */
export const installEscapeForwarder = (
  target: EventTarget,
  dispatch: (event: WebviewKeyboardEventParams) => Promise<void>,
) => {
  target.addEventListener("keydown", (input) => {
    const event = input as KeyboardEvent;
    if (event.key !== "Escape") return;
    // Native events flush microtasks between listeners. A task lets handlers
    // registered later (including document-level dialogs) consume the key.
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
      }).catch(() => {});
    }, 0);
  });
};
