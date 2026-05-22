import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, type WorkbenchModuleContribution } from "../../core";
import {
  disposeWorkbenchModuleHostRegistrations,
  syncWorkbenchModuleHostRegistrations,
  type WorkbenchModuleHostRegistration,
} from "./workbench-module-host";

const createCommandModule = (id: string, commandId: string): WorkbenchModuleContribution => ({
  id,
  activate(ctx) {
    ctx.commands.registerCommand({ id: commandId, label: commandId }, { execute: () => undefined });
  },
});

describe("WorkbenchModuleHost", () => {
  test("syncs registered modules by module id", () => {
    const workbench = createWorkbenchCore();
    const registrations = new Map<string, WorkbenchModuleHostRegistration>();

    syncWorkbenchModuleHostRegistrations(workbench, registrations, [
      createCommandModule("module.a", "command.a"),
      createCommandModule("module.b", "command.b"),
    ]);

    expect(workbench.commands.getCommand("command.a")).toBeDefined();
    expect(workbench.commands.getCommand("command.b")).toBeDefined();

    syncWorkbenchModuleHostRegistrations(workbench, registrations, [createCommandModule("module.b", "command.b")]);

    expect(workbench.commands.getCommand("command.a")).toBeUndefined();
    expect(workbench.commands.getCommand("command.b")).toBeDefined();
  });

  test("disposes all registrations on host teardown", () => {
    const workbench = createWorkbenchCore();
    const registrations = new Map<string, WorkbenchModuleHostRegistration>();

    syncWorkbenchModuleHostRegistrations(workbench, registrations, [createCommandModule("module.a", "command.a")]);
    disposeWorkbenchModuleHostRegistrations(registrations);

    expect(workbench.commands.getCommand("command.a")).toBeUndefined();
    expect(registrations.size).toBe(0);
  });
});
