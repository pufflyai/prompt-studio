import type { WebviewKeyboardShortcut } from "@pstdio/sdk/extensions";
import { hasLocalKeyboardOwner } from "pstdio-extensions/bridge/host";
import { useSyncExternalStore } from "react";
import type { WorkbenchCore } from "../../core";
import { getWebviewKeyboardShortcutStore } from "./webview-keyboard-shortcut-store";
import { createWebviewKeyboardShortcuts } from "./webview-keyboard-shortcuts";

const emptyShortcuts: WebviewKeyboardShortcut[] = [];
const emptyStore = { getSnapshot: () => emptyShortcuts, subscribe: () => () => {} };

export const useWebviewKeyboardShortcuts = (workbench: WorkbenchCore | undefined) => {
  const store = workbench ? getWebviewKeyboardShortcutStore(workbench) : emptyStore;
  const shortcuts = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return {
    keyboardShortcuts: shortcuts,
    onShortcut: async (request: Parameters<ReturnType<typeof createWebviewKeyboardShortcuts>["dispatch"]>[0]) => {
      if (!workbench || hasLocalKeyboardOwner(document)) return;
      await createWebviewKeyboardShortcuts(workbench).dispatch(request);
    },
  };
};
