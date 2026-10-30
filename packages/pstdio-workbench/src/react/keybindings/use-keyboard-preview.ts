import { useEffect } from "react";
import type { WorkbenchCore } from "../../core";

/** Holding Option/Alt previews shortcut hints. Ctrl and Cmd chords are not shortcut previews. */
export const useKeyboardPreview = (workbench: WorkbenchCore) => {
  useEffect(() => {
    const sync = (event: KeyboardEvent) =>
      workbench.keyboard.setPreview(
        event.key === "Alt" ? event.type === "keydown" : event.altKey && !event.ctrlKey && !event.metaKey,
      );
    // Focus can leave for a webview or another window before Alt is released.
    const hide = () => workbench.keyboard.setPreview(false);
    window.addEventListener("keydown", sync, true);
    window.addEventListener("keyup", sync, true);
    window.addEventListener("blur", hide);
    return () => {
      window.removeEventListener("keydown", sync, true);
      window.removeEventListener("keyup", sync, true);
      window.removeEventListener("blur", hide);
      hide();
    };
  }, [workbench]);
};
