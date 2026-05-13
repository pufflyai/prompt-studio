import type { getHotkeyManager, Hotkey } from "@tanstack/hotkeys";
import type { ShellCore } from "pstdio-shell/core";

interface RegisterShellShortcutBindingsInput {
  hotkeyManager: ReturnType<typeof getHotkeyManager>;
  shell?: ShellCore;
  activeScopes: string[];
  onError?: (error: unknown) => void;
  shouldHandle?: (
    keybinding: ReturnType<ShellCore["keybindings"]["listActiveKeybindings"]>[number],
    event: ShellHotkeyEvent,
  ) => boolean;
}

interface ShellHotkeyEvent {
  target?: EventTarget | null;
  preventDefault?: () => void;
}

export const registerShellShortcutBindings = (input: RegisterShellShortcutBindingsInput) => {
  const { activeScopes, hotkeyManager, onError, shell, shouldHandle } = input;
  if (!shell) return [];

  const enabled = activeScopes.includes("global");

  return shell.keybindings.listActiveKeybindings().map((keybinding) =>
    hotkeyManager.register(
      keybinding.keybinding as Hotkey,
      (event) => {
        if (shouldHandle?.(keybinding, event) === false) {
          return;
        }

        event.preventDefault?.();
        void shell.commands.executeCommand(keybinding.commandId, keybinding.args).catch((error) => {
          onError?.(error);
        });
      },
      { enabled, ignoreInputs: false },
    ),
  );
};
