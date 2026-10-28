import { useEffect, useState } from "react";
import type { WorkbenchCore } from "../../core";
import { getKeybindingSteps } from "../../core";
import { useTanStackWorkbenchHotkeys } from "./tanstack-hotkey-adapter";
import { useGlobalKeyboardShortcuts } from "./use-global-keyboard-shortcuts";
import { createWorkbenchHotkeyRegistrations } from "./workbench-hotkey-registrations";

export * from "./workbench-hotkey-registrations";

export interface WorkbenchKeybindingDispatcherProps {
  workbench: WorkbenchCore;
  disabled?: boolean;
  commandIds?: readonly string[];
}

export const WorkbenchKeybindingDispatcher = (props: WorkbenchKeybindingDispatcherProps) => {
  const { workbench, disabled, commandIds } = props;
  const [registrations, setRegistrations] = useState(() =>
    createWorkbenchHotkeyRegistrations({ workbench, disabled, commandIds }),
  );
  useEffect(() => {
    const refresh = () => setRegistrations(createWorkbenchHotkeyRegistrations({ workbench, disabled, commandIds }));
    const subscriptions = [
      workbench.keybindings.store,
      workbench.context.store,
      workbench.commands.store,
      workbench.layout.store,
      workbench.keyboard.store,
    ].map((store) => store.subscribe(refresh));
    const preferences = workbench.preferences.onDidChangeValue(refresh);
    refresh();
    return () => {
      for (const unsubscribe of subscriptions) unsubscribe();
      preferences.dispose();
    };
  }, [workbench, disabled, commandIds]);
  useGlobalKeyboardShortcuts(workbench, disabled, commandIds);
  useTanStackWorkbenchHotkeys(
    registrations.filter(
      (registration) => registration.ignoreInputs || getKeybindingSteps(registration.hotkey).length > 1,
    ),
  );

  return null;
};
