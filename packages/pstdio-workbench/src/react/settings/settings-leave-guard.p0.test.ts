import { expect, test } from "bun:test";
import { createSettingsLeaveGuard } from "./settings-leave-guard";

test("dirty settings stay mounted until save or discard succeeds", async () => {
  const guard = createSettingsLeaveGuard();
  let saved = 0;
  guard.register({
    title: "Runtime",
    dirty: true,
    save: async () => {
      saved++;
    },
    reset: () => {},
  });
  const leaving = guard.request();
  expect(guard.getSnapshot()?.title).toBe("Runtime");
  await guard.leave(true);
  expect(await leaving).toBe(true);
  expect(saved).toBe(1);
});
test("failed save keeps the warning and draft available", async () => {
  const guard = createSettingsLeaveGuard();
  guard.register({
    title: "Tags",
    dirty: true,
    save: async () => {
      throw new Error("Offline");
    },
    reset: () => {},
  });
  const leaving = guard.request();
  await guard.leave(true);
  expect(guard.getSnapshot()?.error).toBe("Offline");
  guard.stay();
  expect(await leaving).toBe(false);
});
test("discard resets edits; another navigation cannot replace a pending decision", async () => {
  const guard = createSettingsLeaveGuard();
  let reset = false;
  guard.register({
    title: "Status",
    dirty: true,
    save: () => {},
    reset: () => {
      reset = true;
    },
  });
  const leaving = guard.request();
  expect(await guard.request()).toBe(false);
  await guard.leave(false);
  expect(await leaving).toBe(true);
  expect(reset).toBe(true);
});
test("live settings leave immediately and stay preserves unsaved edits", async () => {
  const guard = createSettingsLeaveGuard();
  expect(await guard.request()).toBe(true);
  guard.register({ title: "Runtime", dirty: true, save: () => {}, reset: () => {} });
  const leaving = guard.request();
  guard.stay();
  expect(await leaving).toBe(false);
  expect(guard.isDirty()).toBe(true);
});

test("the settings command and rendered page share a guard through scoped module registries", async () => {
  const { createWorkbench } = await import("../../core");
  const { createWorkbenchSettingsModule, WORKBENCH_SETTINGS_OPEN_COMMAND_ID } = await import("./settings-module");
  const { settingsLeaveGuard } = await import("./settings-leave-guard");
  const workbench = createWorkbench();
  for (const id of ["runtime", "appearance"])
    workbench.settings.registerPanel({ id, title: id, kind: "schema", scope: "global", preferences: [] });
  workbench.registerModule(createWorkbenchSettingsModule());
  await workbench.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID, { panelId: "runtime" });
  const guard = settingsLeaveGuard(workbench);
  guard.register({ title: "Runtime", dirty: true, save: () => {}, reset: () => {} });
  const leaving = workbench.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID, { panelId: "appearance" });
  expect(guard.getSnapshot()?.title).toBe("Runtime");
  guard.stay();
  await leaving;
  expect(workbench.layout.getLayout().regions.overlay.widgets[0].resource?.id).toBe("runtime");
});
