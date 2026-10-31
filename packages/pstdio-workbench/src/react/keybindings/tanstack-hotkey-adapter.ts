import { type UseHotkeyDefinition, useHotkeys } from "@tanstack/react-hotkeys";
import type { WorkbenchHotkeyRegistration } from "./workbench-hotkey-registrations";

export const useTanStackWorkbenchHotkeys = (registrations: WorkbenchHotkeyRegistration[]) => {
  const hotkeys: UseHotkeyDefinition[] = registrations.map((registration) => ({
    hotkey: registration.hotkey as UseHotkeyDefinition["hotkey"],
    callback: (event) => {
      if (!registration.enabled) return;
      event.preventDefault();
      void registration.execute();
    },
    options: {
      enabled: registration.enabled,
      ignoreInputs: registration.ignoreInputs,
      preventDefault: true,
      stopPropagation: true,
    },
  }));

  useHotkeys(hotkeys, {
    ignoreInputs: true,
    preventDefault: true,
    stopPropagation: true,
  });
};
