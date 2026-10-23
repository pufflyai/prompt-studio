import { hasLocalKeyboardOwner } from "pstdio-extensions/bridge/host";
import { useEffect, useState } from "react";
import type { WorkbenchCore } from "../../core";
import { createWebviewKeyboardShortcuts } from "./webview-keyboard-shortcuts";

export const useWebviewKeyboardShortcuts = (workbench: WorkbenchCore | undefined) => {
  const [shortcuts, setShortcuts] = useState(() =>
    workbench ? createWebviewKeyboardShortcuts(workbench).shortcuts : [],
  );
  useEffect(() => {
    if (!workbench) {
      setShortcuts([]);
      return;
    }
    const refresh = () => setShortcuts(createWebviewKeyboardShortcuts(workbench).shortcuts);
    const dispose = [
      workbench.keybindings.store,
      workbench.commands.store,
      workbench.context.store,
      workbench.layout.store,
      workbench.keyboard.store,
    ].map((store) => store.subscribe(refresh));
    const preferences = workbench.preferences.onDidChangeValue(refresh);
    refresh();
    return () => {
      for (const stop of dispose) stop();
      preferences.dispose();
    };
  }, [workbench]);
  return {
    keyboardShortcuts: shortcuts,
    onShortcut: async (request: Parameters<ReturnType<typeof createWebviewKeyboardShortcuts>["dispatch"]>[0]) => {
      if (!workbench || hasLocalKeyboardOwner(document)) return;
      await createWebviewKeyboardShortcuts(workbench).dispatch(request);
    },
  };
};
