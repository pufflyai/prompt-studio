import type { WebviewKeyboardShortcut, WebviewKeyboardShortcutRequest } from "@pstdio/sdk/extensions";
import { parseHotkey } from "@tanstack/react-hotkeys";
import type { RegisteredKeybinding, WorkbenchCore } from "../../core";
import { getKeybindingSteps } from "../../core";
import { createWorkbenchHotkeyRegistrations } from "./workbench-hotkey-registrations";

const filterKeybinding = (binding: RegisteredKeybinding) =>
  binding.allowInInputs === true && getKeybindingSteps(binding.keybinding).length === 1;

export const createWebviewKeyboardShortcuts = (workbench: WorkbenchCore, commandIds?: readonly string[]) => {
  const registrations = createWorkbenchHotkeyRegistrations({ workbench, commandIds, filterKeybinding }).filter(
    (registration) => registration.enabled,
  );
  const shortcuts: WebviewKeyboardShortcut[] = registrations.map((registration) => {
    const parsed = parseHotkey(getKeybindingSteps(registration.hotkey)[0]!);
    return {
      id: registration.requestId!,
      entry: registration.entry,
      key: parsed.key,
      ctrlKey: parsed.ctrl,
      metaKey: parsed.meta,
      altKey: parsed.alt,
      shiftKey: parsed.shift,
    };
  });
  return {
    shortcuts,
    async dispatch(request: WebviewKeyboardShortcutRequest) {
      if (request.repeat) return;
      // Resolve again at dispatch; stale iframe profiles never retain a removed binding.
      const registration = createWorkbenchHotkeyRegistrations({ workbench, commandIds, filterKeybinding }).find(
        (candidate) =>
          candidate.enabled &&
          !candidate.ignoreInputs &&
          candidate.requestId === request.id &&
          (!request.nested || candidate.entry),
      );
      await registration?.execute();
    },
  };
};
