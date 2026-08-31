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

const setupPage = () => {
  const workbench = createWorkbenchCore();
  const ticketsRef = { extensionId: "acme.planner", kind: "page" as const, id: "tickets" };
  const ticketRef = { extensionId: "acme.planner", kind: "page" as const, id: "ticket" };
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.layout.registerPanel({ id: "tickets-panel", title: "Tickets", region: "main", rendererId: "tickets" });
  workbench.layout.registerPanel({
    id: "ticket-detail",
    title: "Ticket detail",
    region: "main",
    rendererId: "ticket-detail",
    resourceKinds: ["ticket"],
  });
  workbench.views.registerView({ id: "tickets", panelId: "tickets-panel", title: "Tickets" });
  workbench.views.registerView({ id: "ticket-detail", panelId: "ticket-detail", title: "Ticket" });
  workbench.pages.registerPage({
    id: "tickets",
    ref: ticketsRef,
    path: "tickets",
    modeId: "project",
    slots: [{ id: "content", role: "primary", region: "main", viewId: "tickets" }],
  });
  workbench.pages.registerPage({
    id: "ticket",
    ref: ticketRef,
    path: "ticket",
    modeId: "project",
    parentId: "tickets",
    slots: [
      {
        id: "content",
        role: "primary",
        region: "main",
        binding: { resourceKind: "ticket", viewId: "ticket-detail" },
      },
    ],
  });
  workbench.pageLocations.setProject("project-1");
  workbench.pageLocations.navigate({
    kind: "page",
    page: ticketRef,
    resource: { type: "ticket", id: "ticket-1", label: "PS-1 Ticket" },
  });
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

  test("closes an active page resource through its declared page parent", async () => {
    const workbench = setupPage();
    const activeTicket = workbench.getPrimaryResource()!;

    await executeWorkbenchExtensionCommand(
      {
        executeCommand: () => ({
          commandId: "pstdio.planner.command.delete-ticket",
          extensionId: "pstdio.planner",
          outcome: { ok: true, status: "success", value: { id: activeTicket.id, deleted: true } },
        }),
        projectId: "project-1",
        workbench,
      },
      "pstdio.planner.command.delete-ticket",
      { resource: activeTicket },
    );

    expect(workbench.pages.store.getState().activePageId).toBe("tickets");
    expect(workbench.layout.getLayout().regions.main.widgets).toEqual([
      expect.objectContaining({ contributionId: "tickets-panel" }),
    ]);
  });
});
