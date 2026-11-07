import { expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { createWebviewKeyboardShortcutStore } from "./webview-keyboard-shortcut-store";

test("keeps a webview's negotiated shortcuts unchanged when an unrelated panel is resized", () => {
  const workbench = createWorkbench();
  const store = createWebviewKeyboardShortcutStore(workbench);
  let notices = 0;
  const stop = store.subscribe(() => {
    notices++;
  });
  const initial = store.getSnapshot();
  notices = 0;
  workbench.layout.setRegionSize("secondary", 240);
  expect(store.getSnapshot()).toBe(initial);
  expect(notices).toBe(0);
  stop();
});

test("updates every subscribed webview when an input chord becomes unavailable", () => {
  const workbench = createWorkbench();
  workbench.context.set("enabled", true);
  workbench.commands.registerCommand({ id: "test.open", label: "Open" }, { execute() {} });
  workbench.keybindings.registerKeybinding({
    action: { kind: "command", commandId: "test.open" },
    keybinding: "Alt+Shift+J",
    allowInInputs: true,
    when: "enabled",
  });
  const store = createWebviewKeyboardShortcutStore(workbench);
  const observations: string[][] = [[], []];
  const stops = observations.map((values) =>
    store.subscribe(() => {
      values.push(JSON.stringify(store.getSnapshot()));
    }),
  );
  expect(store.getSnapshot().some((shortcut) => shortcut.key === "J")).toBe(true);
  observations.forEach((values) => {
    values.length = 0;
  });
  workbench.context.set("enabled", false);
  expect(store.getSnapshot().some((shortcut) => shortcut.key === "J")).toBe(false);
  expect(observations[0]).toHaveLength(1);
  expect(observations[1]).toEqual(observations[0]);
  for (const stop of stops) stop();
  workbench.context.set("enabled", true);
  const again = store.subscribe(() => {});
  expect(store.getSnapshot().some((shortcut) => shortcut.key === "J")).toBe(true);
  again();
});
