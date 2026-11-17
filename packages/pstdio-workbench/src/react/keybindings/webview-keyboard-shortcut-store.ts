import type { WorkbenchCore } from "../../core";
import { notifyWorkbenchChange } from "../../core/shared/store/workbench-batch";
import { createWebviewKeyboardShortcuts } from "./webview-keyboard-shortcuts";

export const createWebviewKeyboardShortcutStore = (workbench: WorkbenchCore) => {
  let shortcuts = createWebviewKeyboardShortcuts(workbench).shortcuts;
  const listeners = new Set<() => void>();
  let stops: (() => void)[] = [];
  const refresh = () => {
    notifyWorkbenchChange(listeners, () => {
      const next = createWebviewKeyboardShortcuts(workbench).shortcuts;
      if (
        next.length === shortcuts.length &&
        next.every((shortcut, index) =>
          Object.entries(shortcut).every(([key, value]) => shortcuts[index]?.[key as keyof typeof shortcut] === value),
        )
      )
        return;
      shortcuts = next;
      for (const listener of listeners) listener();
    });
  };
  return {
    getSnapshot: () => shortcuts,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      if (listeners.size === 1) {
        stops = [
          ...[
            workbench.activation.store,
            workbench.keybindings.store,
            workbench.commands.store,
            workbench.context.store,
            workbench.layout.store,
          ].map((store) => store.subscribe(refresh)),
          workbench.keyboard.store.subscribeSelector((state) => state.selectedRegion, refresh),
          workbench.preferences.onDidChangeValue(refresh).dispose,
        ];
        refresh();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size) return;
        for (const stop of stops) stop();
        stops = [];
      };
    },
  };
};

// Every webview in one workbench negotiates the same input chords. Share their
// derivation and subscription lifetime instead of rebuilding one profile per frame.
const stores = new WeakMap<WorkbenchCore, ReturnType<typeof createWebviewKeyboardShortcutStore>>();
export const getWebviewKeyboardShortcutStore = (workbench: WorkbenchCore) => {
  let store = stores.get(workbench);
  if (!store) {
    store = createWebviewKeyboardShortcutStore(workbench);
    stores.set(workbench, store);
  }
  return store;
};
