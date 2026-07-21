import { describe, expect, test } from "bun:test";
import type { CommandExecuteRequest, CommandExecuteResponse, WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbenchCore, type MenuPath } from "../../core";
import { registerWorkbenchExtensionContributions } from "./workbench-extension-host";

const success = (commandId: string): CommandExecuteResponse => ({
  commandId,
  extensionId: "pstdio.lab",
  outcome: { ok: true, status: "success", value: { ok: true } },
});

const webview = {
  entry: { kind: "package-asset" as const, path: "./ticket.tsx", baseUrl: "file:///extension/extension.ts" },
  runtimeUrl: "/runtime.html",
  moduleUrl: "/ticket.js",
  styles: ["/ticket.css"],
};

const metadata = {
  extensions: [{ id: "pstdio.lab", name: "lab", displayName: "Lab", sourcePath: "/extension/extension.ts" }],
  commands: [{ id: "lab.open", extensionId: "pstdio.lab", title: "Open lab" }],
  diagnostics: [],
  menuContributions: [
    {
      id: "lab.open.menu",
      extensionId: "pstdio.lab",
      commandId: "lab.open",
      slotId: "project.headerPrimary",
      label: "Open lab",
      params: { source: "menu" },
    },
  ],
  commandPaletteContributions: [],
  modes: [],
  navigation: [],
  routes: [],
  settingsDefinitions: [],
  settingsPanels: [],
  treeItems: [],
  treeRenderers: [],
  dataRenderers: [],
  views: [
    {
      id: "lab.ticketPanel",
      extensionId: "pstdio.lab",
      slotId: "workbench.main",
      target: "workbench.main",
      title: "Ticket",
      role: "location",
      resourceKind: "ticket",
      webview,
    },
  ],
} satisfies WorkbenchExtensionMetadata;

describe("workbench extension host menu resources", () => {
  test("passes the active primary resource into extension menu command requests", async () => {
    const workbench = createWorkbenchCore();
    const calls: { commandId: string; request: CommandExecuteRequest }[] = [];
    const headerPath: MenuPath = ["project", "header", "primary"];

    registerWorkbenchExtensionContributions({
      executeCommand: async (commandId, request) => {
        calls.push({ commandId, request });
        return success(commandId);
      },
      menuSlotsById: new Map([["project.headerPrimary", { menuPath: headerPath }]]),
      metadata,
      projectId: "project-1",
      workbench,
    });

    workbench.layout.openWidget("lab.ticketPanel", {
      resource: { kind: "ticket", uri: "pstdio://ticket/PS-1", id: "PS-1", label: "PS-1" },
    });

    const menuItem = workbench.layout.listMenuItems(headerPath)[0];
    await workbench.commands.executeCommand(menuItem!.commandId);

    expect(calls.at(-1)).toMatchObject({
      commandId: "lab.open",
      request: {
        params: { source: "menu" },
        resource: { type: "ticket", id: "PS-1", label: "PS-1" },
        source: "dashboard",
      },
    });
  });

  test("uses captured command resource context for delayed menu command execution", async () => {
    const workbench = createWorkbenchCore();
    const calls: { commandId: string; request: CommandExecuteRequest }[] = [];
    const headerPath: MenuPath = ["project", "header", "primary"];

    registerWorkbenchExtensionContributions({
      executeCommand: async (commandId, request) => {
        calls.push({ commandId, request });
        return success(commandId);
      },
      menuSlotsById: new Map([["project.headerPrimary", { menuPath: headerPath }]]),
      metadata,
      projectId: "project-1",
      workbench,
    });

    const captured = { kind: "ticket", uri: "pstdio://ticket/PS-1", id: "PS-1", label: "PS-1" };
    workbench.layout.openWidget("lab.ticketPanel", { resource: captured });
    workbench.layout.openWidget("lab.ticketPanel", {
      resource: { kind: "ticket", uri: "pstdio://ticket/PS-2", id: "PS-2", label: "PS-2" },
    });

    const menuItem = workbench.layout.listMenuItems(headerPath)[0];
    await workbench.commands.executeCommand(menuItem!.commandId, undefined, { resource: captured });

    expect(calls.at(-1)).toMatchObject({
      commandId: "lab.open",
      request: {
        resource: { type: "ticket", id: "PS-1", label: "PS-1" },
      },
    });
  });
});
