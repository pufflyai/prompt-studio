import { expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { createWebviewKeyboardShortcuts } from "./webview-keyboard-shortcuts";
import { createWorkbenchHotkeyRegistrations } from "./workbench-hotkey-registrations";

test("scoped direct bindings resolve availability against every visible target", async () => {
  const workbench = createWorkbench();
  workbench.layout.registerWidget({
    id: "ticket",
    title: "Ticket",
    region: "main",
    rendererId: "test",
    singleton: false,
    reuse: "none",
  });
  workbench.layout.openWidget("ticket", { region: "main", role: "location", resource: { type: "ticket", id: "A" } });
  workbench.layout.setRegionVisible("secondary", true);
  workbench.layout.openWidget("ticket", {
    region: "secondary",
    role: "location",
    resource: { type: "ticket", id: "B" },
  });
  let changed: string | undefined;
  workbench.commands.registerCommand(
    { id: "scoped", label: "Scoped" },
    {
      isVisible: (_args, context) => context?.resource?.id === "B",
      execute: (_args, context) => {
        changed = context?.resource?.id;
      },
    },
  );
  workbench.keybindings.registerKeybinding({
    id: "scoped",
    action: { kind: "command", commandId: "scoped" },
    keybinding: "Alt+Shift+B",
    targetScope: "resource",
    when: "workbench.resource.id == 'B'",
  });
  const registration = createWorkbenchHotkeyRegistrations({ workbench }).find((binding) => binding.id === "scoped");
  expect(registration?.enabled).toBe(true);
  await registration?.execute();
  expect(changed).toBe("B");
});

test("only explicitly global bindings are negotiated for editable webviews", async () => {
  const workbench = createWorkbench();
  let calls = 0;
  workbench.commands.registerCommand(
    { id: "keyboard.open", label: "Keyboard mode" },
    {
      execute: () => {
        calls++;
      },
    },
  );
  workbench.keybindings.registerKeybinding({
    action: { kind: "command", commandId: "keyboard.open" },
    keybinding: "Alt+Shift+K",
    allowInInputs: true,
  });
  workbench.keybindings.registerKeybinding({
    action: { kind: "command", commandId: "keyboard.open" },
    keybinding: "Mod+K",
  });
  const bridge = createWebviewKeyboardShortcuts(workbench);
  const shortcut = bridge.shortcuts.find((shortcut) => shortcut.key === "K")!;
  expect(shortcut).toMatchObject({ key: "K", altKey: true, shiftKey: true });
  await bridge.dispatch({ id: shortcut.id, repeat: false });
  expect(calls).toBe(1);
});

test("disposed or rebound chords cannot execute stale requests", async () => {
  const workbench = createWorkbench();
  let calls = 0;
  workbench.commands.registerCommand(
    { id: "keyboard.open", label: "Keyboard mode" },
    {
      execute: () => {
        calls++;
      },
    },
  );
  const binding = workbench.keybindings.registerKeybinding({
    action: { kind: "command", commandId: "keyboard.open" },
    keybinding: "Alt+Shift+K",
    allowInInputs: true,
  });
  const stale = createWebviewKeyboardShortcuts(workbench).shortcuts.find((shortcut) => shortcut.key === "K")!;
  binding.dispose();
  await createWebviewKeyboardShortcuts(workbench).dispatch({ id: stale.id, repeat: false });
  expect(calls).toBe(0);
});

test("repeat cannot enter a global shortcut twice", async () => {
  const workbench = createWorkbench();
  let calls = 0;
  workbench.commands.registerCommand(
    { id: "keyboard.open", label: "Keyboard mode" },
    {
      execute: () => {
        calls++;
      },
    },
  );
  workbench.keybindings.registerKeybinding({
    action: { kind: "command", commandId: "keyboard.open" },
    keybinding: "Alt+Shift+K",
    allowInInputs: true,
  });
  const bridge = createWebviewKeyboardShortcuts(workbench);
  await bridge.dispatch({ id: bridge.shortcuts.find((shortcut) => shortcut.key === "K")!.id, repeat: true });
  expect(calls).toBe(0);
});
