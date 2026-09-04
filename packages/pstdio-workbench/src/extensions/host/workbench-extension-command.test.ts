import { describe, expect, test } from "bun:test";
import { createWorkbench } from "../../core";
import { executeWorkbenchExtensionCommand } from "./workbench-extension-command";

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
        binding: { resourceKinds: ["ticket"], viewId: "ticket-detail", cardinality: "one" },
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
      expect.objectContaining({ contributionId: "workbench.page-placement.tickets.content" }),
    ]);
  });
});
