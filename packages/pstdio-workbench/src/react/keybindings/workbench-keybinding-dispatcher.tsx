import { useEffect, useState } from "react";
import type { RegisteredKeybinding, WorkbenchCore } from "../../core";
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

// Single global input chords belong to useGlobalKeyboardShortcuts. Do not
// evaluate their command availability just to discard their registrations.
const filterKeybinding = (binding: RegisteredKeybinding) =>
  !binding.allowInInputs || getKeybindingSteps(binding.keybinding).length > 1;

export const WorkbenchKeybindingDispatcher = (props: WorkbenchKeybindingDispatcherProps) => {
  const { workbench, disabled, commandIds } = props;
  const [registrations, setRegistrations] = useState(() =>
    createWorkbenchHotkeyRegistrations({ workbench, disabled, commandIds, filterKeybinding }),
  );
  useEffect(() => {
    let disposed = false;
    let pending = false;
    // A project or panel transition updates several stores. Read its completed state once,
    // instead of forcing DOM visibility checks in the middle of each store notification.
    const refresh = () => {
      if (pending) return;
      pending = true;
      queueMicrotask(() => {
        pending = false;
        if (!disposed)
          setRegistrations(createWorkbenchHotkeyRegistrations({ workbench, disabled, commandIds, filterKeybinding }));
      });
    };
    const subscriptions = [
      ...[
        workbench.activation.store,
        workbench.keybindings.store,
        workbench.context.store,
        workbench.commands.store,
        workbench.layout.store,
      ].map((store) => store.subscribe(refresh)),
      // Only the selected panel changes which shortcuts apply; previews and typed keys do not.
      workbench.keyboard.store.subscribeSelector((state) => state.selectedRegion, refresh),
    ];
    const preferences = workbench.preferences.onDidChangeValue(refresh);
    refresh();
    return () => {
      disposed = true;
      for (const unsubscribe of subscriptions) unsubscribe();
      preferences.dispose();
    };
  }, [workbench, disabled, commandIds]);
  useGlobalKeyboardShortcuts(workbench, disabled, commandIds);
  useTanStackWorkbenchHotkeys(registrations);

  return null;
};
