import { describe, expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { createWorkbenchHotkeyRegistrations, normalizeWorkbenchKeybinding } from "./workbench-keybinding-dispatcher";

test("direct shortcuts do not inspect unrelated actions without an assigned chord", async () => {
  const workbench = createWorkbench();
  workbench.commands.registerCommand(
    { id: "unrelated", label: "Unrelated action" },
    {
      execute() {},
      isVisible: () => {
        throw new Error("This action is unrelated to the pressed shortcut");
      },
    },
  );
  let calls = 0;
  workbench.commands.registerCommand({ id: "direct", label: "Direct action" }, { execute: () => calls++ });
  workbench.keybindings.registerKeybinding({ action: { kind: "command", commandId: "direct" }, keybinding: "Alt+J" });
  const registration = createWorkbenchHotkeyRegistrations({ workbench }).find((entry) => entry.id === "direct")!;
  expect(registration.enabled).toBe(true);
  await registration.execute();
  expect(calls).toBe(1);
});

test("rebinding a generated layer shortcut to a direct chord retains its identity and executes", async () => {
  const workbench = createWorkbench();
  let calls = 0;
  workbench.commands.registerCommand(
    { id: "test.rebound", label: "Rebound action" },
    {
      execute: () => {
        calls++;
      },
    },
  );
  workbench.keybindings.registerKeybinding({
    action: { kind: "command", commandId: "test.rebound" },
    layer: "settings",
    keybinding: "Q",
  });
  const declared = workbench.keybindings
    .listKeybindings()
    .find((binding) => binding.layer === "settings" && binding.keybinding === "Q")!;
  const id = workbench.keybindings.getId(declared);
  await workbench.keyboard.setAssignment(id, { layer: "direct", keybinding: "Alt+J" });
  const registration = createWorkbenchHotkeyRegistrations({ workbench }).find((entry) => entry.id === "test.rebound")!;
  expect(registration.enabled).toBe(true);
  await registration.execute();
  expect(calls).toBe(1);
});

test("resource shortcuts require a resource while panel shortcuts allow an empty panel", () => {
  const workbench = createWorkbench();
  workbench.layout.registerWidget({ id: "empty", title: "Empty", region: "main", rendererId: "test" });
  workbench.layout.openWidget("empty", { region: "main" });
  for (const targetScope of ["resource", "panel"] as const) {
    workbench.commands.registerCommand({ id: targetScope, label: targetScope }, { execute() {} });
    workbench.keybindings.registerKeybinding({
      id: targetScope,
      action: { kind: "command", commandId: targetScope },
      keybinding: targetScope === "resource" ? "Alt+R" : "Alt+P",
      targetScope,
    });
  }
  expect(workbench.keyboard.visibleTargets()).toHaveLength(1);
  const registrations = createWorkbenchHotkeyRegistrations({ workbench });
  expect(registrations.find((entry) => entry.id === "resource")?.enabled).toBe(false);
  expect(registrations.find((entry) => entry.id === "panel")?.enabled).toBe(true);
});

test("direct shortcuts recheck live visibility when matched and executed", async () => {
  const workbench = createWorkbench();
  let visible = false;
  let executed = 0;
  workbench.commands.registerCommand(
    { id: "live", label: "Live" },
    {
      isVisible: () => visible,
      execute: () => {
        executed++;
      },
    },
  );
  workbench.keybindings.registerKeybinding({ action: { kind: "command", commandId: "live" }, keybinding: "Alt+J" });
  expect(createWorkbenchHotkeyRegistrations({ workbench }).find((entry) => entry.id === "live")?.enabled).toBe(false);
  visible = true;
  const match = createWorkbenchHotkeyRegistrations({ workbench }).find((entry) => entry.id === "live")!;
  expect(match.enabled).toBe(true);
  visible = false;
  await match.execute();
  expect(executed).toBe(0);
});

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

test("only the active workbench executes shortcuts, including registrations captured before switching", async () => {
  const a = createWorkbench();
  const b = createWorkbench({ active: false });
  let aCalls = 0;
  let bCalls = 0;
  a.commands.registerCommand(
    { id: "shared", label: "Shared action" },
    {
      execute: () => {
        aCalls++;
      },
    },
  );
  b.commands.registerCommand(
    { id: "shared", label: "Shared action" },
    {
      execute: () => {
        bCalls++;
      },
    },
  );
  for (const workbench of [a, b])
    workbench.keybindings.registerKeybinding({ action: { kind: "command", commandId: "shared" }, keybinding: "Alt+J" });
  const old = createWorkbenchHotkeyRegistrations({ workbench: a }).find((entry) => entry.id === "shared")!;
  expect(createWorkbenchHotkeyRegistrations({ workbench: b })).toEqual([]);
  a.activation.setActive(false);
  b.activation.setActive(true);
  await old.execute();
  await createWorkbenchHotkeyRegistrations({ workbench: b })
    .find((entry) => entry.id === "shared")!
    .execute();
  expect(aCalls).toBe(0);
  expect(bCalls).toBe(1);
});
