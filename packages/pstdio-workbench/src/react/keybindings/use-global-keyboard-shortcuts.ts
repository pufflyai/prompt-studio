import { availableKeyboardShortcuts, installKeyboardShortcuts } from "pstdio-extensions/bridge/host";
import { useEffect } from "react";
import type { WorkbenchCore } from "../../core";
import { getWebviewKeyboardShortcutStore } from "./webview-keyboard-shortcut-store";
import { createWebviewKeyboardShortcuts } from "./webview-keyboard-shortcuts";

/** Capture explicitly global entry chords before editors and xterm can write them. */
export const useGlobalKeyboardShortcuts = (
  workbench: WorkbenchCore,
  disabled?: boolean,
  commandIds?: readonly string[],
) => {
  useEffect(() => {
    const store = getWebviewKeyboardShortcutStore(workbench);
    const stop = store.subscribe(() => {});
    const uninstall = installKeyboardShortcuts(
      document,
      () =>
        disabled || !workbench.activation.isActive()
          ? []
          : availableKeyboardShortcuts(
              document,
              (commandIds
                ? createWebviewKeyboardShortcuts(workbench, commandIds).shortcuts
                : store.getSnapshot()
              ).filter((shortcut) => !shortcut.ignoreInputs),
            ),
      (request) => {
        void createWebviewKeyboardShortcuts(workbench, commandIds).dispatch(request);
      },
    );
    return () => {
      uninstall();
      stop();
    };
  }, [workbench, disabled, commandIds]);
};
