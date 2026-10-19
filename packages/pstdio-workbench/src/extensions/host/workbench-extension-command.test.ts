import { describe, expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import {
  executeWorkbenchExtensionCommand,
  executeWorkbenchExtensionCommandResponse,
} from "./workbench-extension-command";

const setupPage = () => {
  const workbench = createWorkbench();
  const ticketsRef = { extensionId: "acme.planner", kind: "page" as const, id: "tickets" };
  const ticketRef = { extensionId: "acme.planner", kind: "page" as const, id: "ticket" };
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.views.registerView({
    id: "tickets",
    title: "Tickets",
    body: { kind: "react", render: () => null },
  });
  workbench.views.registerView({
    id: "ticket-detail",
    title: "Ticket detail",
    body: { kind: "react", render: () => null },
  });
  workbench.pages.registerPage({
    id: "tickets",
    ref: ticketsRef,
    path: "tickets",
    modeId: "project",
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: "tickets",
      },
      cardinality: "one",
    },
    slots: [],
  });
  workbench.pages.registerPage({
    id: "ticket",
    ref: ticketRef,
    path: "ticket",
    modeId: "project",
    parentId: "tickets",
    resource: {
      kinds: [
        {
          kind: "resource-kind",
          id: "ticket",
        },
      ],
    },
    main: {
      kind: "view",
      view: {
        kind: "view",
        id: "ticket-detail",
      },
      cardinality: "one",
    },
    slots: [],
  });
  workbench.pageLocations.setProject("project-1");
  workbench.pageLocations.navigate({
    kind: "page",
    page: ticketRef,
    resource: {
      type: "ticket",
      id: "ticket-1",
      label: "PS-1 Ticket",
      extensionId: "acme.planner",
      projectId: "project-1",
    },
  });
  return workbench;
};
describe("executeWorkbenchExtensionCommand", () => {
  test("a command navigation result keeps the Add destination for the next command", async () => {
    const workbench = setupPage();
    workbench.shellPlacements.registerPlacement({
      id: "tool",
      region: "side",
      item: { kind: "view", view: { kind: "view", id: "ticket-detail" }, presence: "closed" },
    });
    workbench.commands.registerCommand(
      { id: "second", label: "Create tool" },
      {
        execute: (_args, context) => {
          workbench.shellPlacements.openPlacement({ placementId: "tool", region: context?.region });
        },
      },
    );
    await executeWorkbenchExtensionCommandResponse(
      {
        projectId: "project-1",
        workbench,
        executeCommand: () => ({
          outcome: {
            ok: true,
            status: "success",
            navigationRequests: [
              {
                kind: "command",
                target: { command: { kind: "command", id: "second" } },
              },
            ],
          },
        }),
      },
      "create-tool",
      { region: "secondary" },
    );
    expect(workbench.layout.getActivePanel("secondary")).toBeDefined();
    expect(workbench.layout.listPanelInstances("side")).toEqual([]);
  });
  test("an Add command opens extension navigation results directly in the requested panel", async () => {
    const workbench = setupPage();
    const panel = { kind: "placement" as const, extensionId: "acme.planner", id: "tool" };
    workbench.modePlacements.registerPlacement({
      id: "tool",
      ref: panel,
      modeId: "project",
      region: "side",
      item: {
        kind: "binding",
        binding: {
          view: { kind: "view", id: "ticket-detail" },
          kinds: [{ kind: "resource-kind", id: "tool" }],
          cardinality: "many",
        },
      },
    });
    workbench.shell.setRegionOpen("side", true);
    const seen: number[] = [];
    const unsubscribe = workbench.layout.store.subscribe(() =>
      seen.push(workbench.layout.listPanelInstances("side").length),
    );
    await executeWorkbenchExtensionCommandResponse(
      {
        projectId: "project-1",
        workbench,
        executeCommand: () => ({
          outcome: {
            ok: true,
            status: "success",
            navigationRequests: [
              {
                kind: "compound",
                targets: [{ kind: "panel", panel, resource: { type: "tool", id: "created" }, open: "pin" }],
              },
            ],
          },
        }),
      },
      "create-tool",
      { region: "secondary" },
    );
    unsubscribe();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((count) => count === 0)).toBe(true);
    expect(workbench.layout.getActivePanel("secondary")?.resource?.id).toBe("created");
    expect(workbench.shell.getRegionState("side").open).toBe(true);
  });
  test("preserves the response envelope when navigation conversion rejects a target", async () => {
    const workbench = setupPage();
    const response = {
      outcome: {
        ok: true,
        status: "success",
        value: { id: "created" },
        navigationRequests: [{ kind: "href", href: "javascript:alert(1)" }],
      },
    };
    expect(
      await executeWorkbenchExtensionCommandResponse(
        { projectId: "project-1", workbench, executeCommand: () => response },
        "create",
      ),
    ).toBe(response);
    expect(workbench.notifications.listNotifications()).toHaveLength(1);
  });

  test("still rejects failed commands without applying their navigation", async () => {
    const workbench = setupPage();
    await expect(
      executeWorkbenchExtensionCommand(
        {
          projectId: "project-1",
          workbench,
          executeCommand: () => ({
            outcome: {
              ok: false,
              status: "error",
              error: { message: "Create failed" },
              navigationRequests: [
                { kind: "page", page: { kind: "page", id: "tickets", extensionId: "acme.planner" } },
              ],
            },
          }),
        },
        "create",
      ),
    ).rejects.toThrow("Create failed");
    expect(workbench.pages.store.getState().activePageId).toBe("ticket");
    expect(workbench.notifications.listNotifications()).toEqual([]);
  });

  test("keeps committed command success when navigation fails and continues later requests", async () => {
    const workbench = setupPage();
    const created: string[] = [];
    const result = await executeWorkbenchExtensionCommand(
      {
        projectId: "project-1",
        workbench,
        executeCommand: () => {
          created.push("created");
          return {
            outcome: {
              ok: true,
              status: "success",
              value: { id: "created" },
              navigationRequests: [
                { kind: "panel", panel: { kind: "placement", id: "unavailable", extensionId: "acme.planner" } },
                { kind: "page", page: { kind: "page", id: "tickets", extensionId: "acme.planner" } },
              ],
            },
          };
        },
      },
      "create",
    );
    expect(result).toEqual({ id: "created" });
    expect(created).toEqual(["created"]);
    expect(workbench.pages.store.getState().activePageId).toBe("tickets");
    expect(workbench.notifications.listNotifications()).toEqual([
      expect.objectContaining({
        level: "error",
        inlineTarget: "region:main",
        message: expect.stringContaining("unavailable"),
      }),
    ]);
  });

  test("applies explicit navigation once while returning ordinary data", async () => {
    const workbench = setupPage();
    const value = { id: "created" };
    const result = await executeWorkbenchExtensionCommand(
      {
        projectId: "project-1",
        workbench,
        executeCommand: () => ({
          outcome: {
            ok: true,
            status: "success",
            value,
            navigationRequests: [{ kind: "page", page: { kind: "page", id: "tickets", extensionId: "acme.planner" } }],
          },
        }),
      },
      "create",
    );
    expect(result).toEqual(value);
    expect(workbench.pages.store.getState().activePageId).toBe("tickets");
  });

  test("returns target-shaped data without navigation", async () => {
    const workbench = setupPage();
    const value = { kind: "page", page: { kind: "page", id: "tickets", extensionId: "acme.planner" } };
    expect(
      await executeWorkbenchExtensionCommand(
        {
          projectId: "project-1",
          workbench,
          executeCommand: () => ({ outcome: { ok: true, status: "success", value } }),
        },
        "query",
      ),
    ).toEqual(value);
    expect(workbench.pages.store.getState().activePageId).toBe("ticket");
  });
});

describe("command result data", () => {
  test("preserves explicit navigation when command data includes deletion fields", async () => {
    const workbench = setupPage();
    const activeTicket = workbench.getPrimaryResource()!;
    const value = { id: activeTicket.id, deleted: true };
    const result = await executeWorkbenchExtensionCommand(
      {
        executeCommand: () => ({
          commandId: "pstdio.planner.command.delete-ticket",
          extensionId: "pstdio.planner",
          outcome: {
            ok: true,
            status: "success",
            value,
            navigationRequests: [
              {
                kind: "page",
                page: { kind: "page", id: "ticket", extensionId: "acme.planner" },
                resource: activeTicket,
              },
            ],
          },
        }),
        projectId: "project-1",
        workbench,
      },
      "pstdio.planner.command.delete-ticket",
      { resource: workbench.breadcrumbs.getItems()?.at(-1)?.resource },
    );
    expect(result).toEqual(value);
    expect(workbench.pages.store.getState().activePageId).toBe("ticket");
    expect(workbench.getPrimaryResource()).toEqual(activeTicket);
  });
});
