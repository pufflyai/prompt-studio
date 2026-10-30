import type { WebviewKeyboardShortcut, WebviewKeyboardShortcutRequest } from "@pstdio/sdk/extensions";
import { parseHotkey } from "@tanstack/react-hotkeys";
import type { WorkbenchCore } from "../../core";
import { getKeybindingSteps } from "../../core";
import { createWorkbenchHotkeyRegistrations } from "./workbench-hotkey-registrations";

export const createWebviewKeyboardShortcuts = (workbench: WorkbenchCore, commandIds?: readonly string[]) => {
  const registrations = createWorkbenchHotkeyRegistrations({ workbench, commandIds }).filter(
    (registration) => registration.enabled && getKeybindingSteps(registration.hotkey).length === 1,
  );
  const shortcuts: WebviewKeyboardShortcut[] = registrations
    .map((registration) => {
      const parsed = parseHotkey(getKeybindingSteps(registration.hotkey)[0]!);
      return {
        id: registration.requestId!,
        allowInInputs: !registration.ignoreInputs,
        entry: registration.entry,
        key: parsed.key,
        ctrlKey: parsed.ctrl,
        metaKey: parsed.meta,
        altKey: parsed.alt,
        shiftKey: parsed.shift,
      };
    })
    .filter((shortcut) => !shortcut.allowInInputs || shortcut.altKey || shortcut.ctrlKey || shortcut.metaKey);
  return {
    shortcuts,
    async dispatch(request: WebviewKeyboardShortcutRequest) {
      if (request.repeat) return;
      // Resolve again at dispatch; stale iframe profiles never retain a removed binding.
      const registration = createWorkbenchHotkeyRegistrations({ workbench, commandIds }).find(
        (candidate) => candidate.enabled && candidate.requestId === request.id && (!request.nested || candidate.entry),
      );
      await registration?.execute();
    },
  };
};
