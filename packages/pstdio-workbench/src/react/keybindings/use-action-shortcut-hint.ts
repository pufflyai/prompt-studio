import { useSyncExternalStore } from "react";
import type { NavigationTarget, WorkbenchCoreContributionContext } from "../../core";

/** A layout change can affect availability without changing the shortcut displayed beside an action. */
export const useActionShortcutHint = (workbench: WorkbenchCoreContributionContext, action?: NavigationTarget) => {
  const subscribe = (changed: () => void) => {
    const stops = [
      workbench.keyboard.store,
      workbench.keybindings.store,
      workbench.commands.store,
      workbench.context.store,
      workbench.layout.store,
    ].map((store) => store.subscribe(changed));
    const preference = workbench.preferences.onDidChangeValue(changed);
    return () => {
      for (const stop of stops) stop();
      preference.dispose();
    };
  };
  const read = () => (action ? workbench.keyboard.hint(action) : undefined);
  return useSyncExternalStore(subscribe, read, read);
};
