import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, type ResourceRef } from "../../core";
import { executeWorkbenchExtensionCommand } from "./workbench-extension-command";

const ticket: ResourceRef = {
  kind: "ticket",
  uri: "pstdio://ticket/ticket-1",
  id: "ticket-1",
  label: "PS-1 Ticket",
};

const setup = async () => {
  const workbench = createWorkbenchCore();
  workbench.resources.registerKind({ kind: "ticket", label: "Ticket", surface: "primary" });
  workbench.layout.registerPanel({
    id: "ticket-detail",
    title: "Ticket detail",
    region: "main",
    rendererId: "ticket-detail",
    resourceKinds: ["ticket"],
  });
  workbench.layout.registerPanel({
    id: "tickets-panel",
    title: "Tickets",
    region: "main",
    rendererId: "tickets",
  });
  workbench.views.registerView({ id: "tickets", panelId: "tickets-panel", title: "Tickets" });
  workbench.resources.registerPresenter({
    id: "ticket-detail",
    canOpen: (resource) => resource.kind === "ticket",
    open: (resource) => workbench.layout.openPanel("ticket-detail", { resource }),
  });
  workbench.resources.registerHierarchyProvider({
    id: "ticket-hierarchy",
    canResolve: (resource) => resource.kind === "ticket",
    getParent: () => ({ type: "view", viewId: "tickets" }),
  });
  await workbench.resources.openResource(ticket);
  return workbench;
};

describe("executeWorkbenchExtensionCommand", () => {
  test("opens the declared parent when a command deletes the active resource", async () => {
    const workbench = await setup();
    const openedViews: string[] = [];
    workbench.views.onDidOpenView(({ viewId }) => openedViews.push(viewId));

    await executeWorkbenchExtensionCommand(
      {
        executeCommand: () => ({
          commandId: "pstdio.planner.command.delete-ticket",
          extensionId: "pstdio.planner",
          outcome: { ok: true, status: "success", value: { id: ticket.id, deleted: true } },
        }),
        projectId: "project-1",
        workbench,
      },
      "pstdio.planner.command.delete-ticket",
      { resource: ticket },
    );

    expect(openedViews).toEqual(["tickets"]);
    expect(workbench.getPrimaryResource()).toBeUndefined();
  });

  test("does not leave the current page when a command deletes another resource", async () => {
    const workbench = await setup();
    const otherTicket = { ...ticket, id: "ticket-2", uri: "pstdio://ticket/ticket-2" };
    const openedViews: string[] = [];
    workbench.views.onDidOpenView(({ viewId }) => openedViews.push(viewId));

    await executeWorkbenchExtensionCommand(
      {
        executeCommand: () => ({
          commandId: "pstdio.planner.command.delete-ticket",
          extensionId: "pstdio.planner",
          outcome: { ok: true, status: "success", value: { id: otherTicket.id, deleted: true } },
        }),
        projectId: "project-1",
        workbench,
      },
      "pstdio.planner.command.delete-ticket",
      { resource: otherTicket },
    );

    expect(openedViews).toEqual([]);
    expect(workbench.getPrimaryResource()).toEqual(ticket);
  });
});
