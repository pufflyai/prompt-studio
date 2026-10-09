import { describe, expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { createWorkbenchHotkeyRegistrations, normalizeWorkbenchKeybinding } from "./workbench-keybinding-dispatcher";

describe("createWorkbenchHotkeyRegistrations", () => {
  test("asks for command parameters before a shortcut executes a creation action", async () => {
    const workbench = createWorkbench();
    let title: unknown;
    workbench.commands.registerCommand(
      { id: "notes.create", label: "New note", params: { title: { type: "text", required: true } } },
      {
        execute: (args) => {
          title = args;
        },
      },
    );
    workbench.keybindings.registerKeybinding({
      action: { kind: "command", commandId: "notes.create" },
      keybinding: "Mod+Alt+N",
    });
    await createWorkbenchHotkeyRegistrations({ workbench })
      .find((item) => item.id === "notes.create")!
      .execute();
    expect(workbench.commandPalette.store.getState().paramsRequest).toMatchObject({
      label: "New note",
      record: { command: { id: "notes.create" } },
    });
    await workbench.commands.executeCommand("notes.create", { title: "My note" });
    expect(title).toEqual({ title: "My note" });
  });
  test("maps active keybindings to command-backed hotkey registrations", async () => {
    const workbench = createWorkbench();
    let executed = false;

    workbench.commands.registerCommand(
      { id: "project.refresh", label: "Refresh project" },
      { execute: () => (executed = true) },
    );
    workbench.keybindings.registerKeybinding({
      action: { kind: "command", commandId: "project.refresh" },
      keybinding: "mod+r",
      when: "activeWorkbenchMode == project",
    });
    workbench.context.set("activeWorkbenchMode", "project");

    const registrations = createWorkbenchHotkeyRegistrations({ workbench });

    expect(registrations).toContainEqual(
      expect.objectContaining({
        id: "project.refresh",
        hotkey: "Mod+R",
        enabled: true,
        ignoreInputs: true,
      }),
    );

    await registrations.find((registration) => registration.id === "project.refresh")?.execute();

    expect(executed).toBe(true);
  });

  test("normalizes keybinding chords for hotkey registrations", () => {
    expect(normalizeWorkbenchKeybinding(["ctrl+shift+s", "n"])).toEqual(["Control+Shift+S", "N"]);
    expect(normalizeWorkbenchKeybinding("ctrl+shift+s n")).toEqual(["Control+Shift+S", "N"]);
  });

  test("maps chord keybindings to command-backed hotkey registrations", () => {
    const workbench = createWorkbench();

    workbench.commands.registerCommand({ id: "sessions.new", label: "New Session" }, { execute: () => undefined });
    workbench.keybindings.registerKeybinding({
      action: { kind: "command", commandId: "sessions.new" },
      keybinding: "Ctrl+Shift+S N",
    });

    expect(createWorkbenchHotkeyRegistrations({ workbench })).toContainEqual(
      expect.objectContaining({
        id: "sessions.new",
        hotkey: ["Control+Shift+S", "N"],
      }),
    );
  });

  test("filters registrations to allowed command ids", () => {
    const workbench = createWorkbench();

    const registrations = createWorkbenchHotkeyRegistrations({
      workbench,
      commandIds: ["workbench.action.navigateBack", "workbench.action.navigateForward"],
    });

    expect(registrations.map((registration) => registration.id).sort()).toEqual([
      "workbench.action.navigateBack",
      "workbench.action.navigateForward",
    ]);
  });
});

test("a failed keybinding reports its command once and consumes the rejection", async () => {
  const workbench = createWorkbench();
  workbench.commands.registerCommand(
    { id: "project.save", label: "Save project" },
    {
      execute: async () => {
        throw new Error("Connection lost");
      },
    },
  );
  workbench.keybindings.registerKeybinding({
    action: { kind: "command", commandId: "project.save" },
    keybinding: "Ctrl+Shift+Y",
  });
  const registration = createWorkbenchHotkeyRegistrations({ workbench }).find((item) => item.id === "project.save")!;
  await expect(registration.execute()).resolves.toBeUndefined();
  expect(workbench.notifications.listNotifications()).toMatchObject([
    { title: "Save project failed", message: "Connection lost", level: "error" },
  ]);
});
