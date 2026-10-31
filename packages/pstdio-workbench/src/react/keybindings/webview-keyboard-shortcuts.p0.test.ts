import { expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { createWebviewKeyboardShortcuts } from "./webview-keyboard-shortcuts";
import { createWorkbenchHotkeyRegistrations } from "./workbench-hotkey-registrations";

test.each([
  { keybinding: "Alt+J", allowInInputs: false },
  { keybinding: ["Alt+J", "K"], allowInInputs: true },
])("webview profiles do not inspect shortcuts they cannot relay: %j", (binding) => {
  const workbench = createWorkbench();
  workbench.commands.registerCommand(
    { id: "excluded", label: "Excluded" },
    {
      execute() {},
      isEnabled: () => {
        throw new Error("This shortcut is not part of the webview profile");
      },
    },
  );
  workbench.keybindings.registerKeybinding({ action: { kind: "command", commandId: "excluded" }, ...binding });
  expect(createWebviewKeyboardShortcuts(workbench).shortcuts.length).toBeGreaterThan(0);
});

test("the fullscreen shortcut toggles from editable nested content and completes shortcut mode", async () => {
  const workbench = createWorkbench();
  workbench.context.set("inputFocus", true);
  const bridge = createWebviewKeyboardShortcuts(workbench);
  const shortcut = bridge.shortcuts.find((shortcut) => shortcut.key === "Z")!;
  expect(shortcut?.entry).toBe("panel");
  await bridge.dispatch({ id: shortcut.id, repeat: false, nested: true });
  expect(workbench.fullscreen.store.getState().active).toBe(true);
  expect(workbench.keyboard.store.getState().active).toBe(false);
  workbench.keyboard.open();
  await bridge.dispatch({ id: shortcut.id, repeat: false, nested: true });
  expect(workbench.fullscreen.store.getState().active).toBe(false);
  expect(workbench.keyboard.store.getState().active).toBe(false);
});

test("nested previews can toggle navigation, side and bottom panels through negotiated layout shortcuts", async () => {
  const workbench = createWorkbench();
  for (const [region, key] of [
    ["sidenav", "S"],
    ["side", "E"],
    ["secondary", "B"],
  ] as const) {
    workbench.layout.registerWidget({ id: region, title: region, region, rendererId: "test", singleton: false });
    workbench.shell.setRegionOpen(region, false);
    workbench.context.set("inputFocus", true);
    const bridge = createWebviewKeyboardShortcuts(workbench);
    const shortcut = bridge.shortcuts.find((shortcut) => shortcut.key === key)!;
    expect(shortcut?.entry).toBe("panel");
    await bridge.dispatch({ id: shortcut.id, repeat: false, nested: true });
    expect(workbench.shell.getRegionState(region).open).toBe(true);
    await bridge.dispatch({ id: shortcut.id, repeat: false, nested: true });
    expect(workbench.shell.getRegionState(region).open).toBe(false);
  }
});

test("nested previews can cycle tabs through the negotiated tab navigation chords", async () => {
  const workbench = createWorkbench();
  workbench.layout.registerWidget({
    id: "editor",
    title: "Editor",
    region: "main",
    rendererId: "test",
    singleton: false,
    reuse: "none",
    closable: true,
  });
  const first = workbench.layout.openWidget("editor", { region: "main", role: "location", tabRetention: "persistent" });
  const second = workbench.layout.openWidget("editor", {
    region: "main",
    role: "location",
    tabRetention: "persistent",
  });
  workbench.layout.activateWidget(first.widgetId);
  const bridge = createWebviewKeyboardShortcuts(workbench);
  const next = bridge.shortcuts.find(
    (shortcut) => shortcut.key.toUpperCase() === "TAB" && shortcut.ctrlKey && !shortcut.shiftKey,
  )!;
  await bridge.dispatch({ id: next.id, repeat: false, nested: true });
  expect(workbench.layout.getLayout().activeWidgetId).toBe(second.widgetId);
  expect(workbench.keyboard.store.getState().active).toBe(false);
  const previous = bridge.shortcuts.find(
    (shortcut) => shortcut.key.toUpperCase() === "TAB" && shortcut.ctrlKey && shortcut.shiftKey,
  )!;
  await bridge.dispatch({ id: previous.id, repeat: false, nested: true });
  expect(workbench.layout.getLayout().activeWidgetId).toBe(first.widgetId);
});

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

test("only chords that hold Alt, Ctrl or Cmd are offered while typing", () => {
  const workbench = createWorkbench();
  workbench.commands.registerCommand({ id: "plain", label: "Plain" }, { execute() {} });
  workbench.keybindings.registerKeybinding({
    action: { kind: "command", commandId: "plain" },
    keybinding: "Shift+J",
    allowInInputs: true,
  });
  const { shortcuts } = createWebviewKeyboardShortcuts(workbench);
  expect(shortcuts.length).toBeGreaterThan(0);
  expect(shortcuts.every((shortcut) => shortcut.altKey || shortcut.ctrlKey || shortcut.metaKey)).toBe(true);
});
