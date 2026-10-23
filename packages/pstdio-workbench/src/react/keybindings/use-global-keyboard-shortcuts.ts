import { hasLocalKeyboardOwner, installKeyboardShortcuts } from "pstdio-extensions/bridge/host";
import { useEffect } from "react";
import type { WorkbenchCore } from "../../core";
import { createWebviewKeyboardShortcuts } from "./webview-keyboard-shortcuts";

/** Capture explicitly global entry chords before editors and xterm can write them. */
export const useGlobalKeyboardShortcuts = (
  workbench: WorkbenchCore,
  disabled?: boolean,
  commandIds?: readonly string[],
) => {
  useEffect(
    () =>
      installKeyboardShortcuts(
        document,
        () =>
          disabled || hasLocalKeyboardOwner(document)
            ? []
            : createWebviewKeyboardShortcuts(workbench, commandIds).shortcuts,
        (request) => {
          void createWebviewKeyboardShortcuts(workbench, commandIds).dispatch(request);
        },
      ),
    [workbench, disabled, commandIds],
  );
};
