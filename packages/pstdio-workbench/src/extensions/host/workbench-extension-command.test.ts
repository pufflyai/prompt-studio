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
  test("closes a scoped page resource through a breadcrumb delete action", async () => {
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
      { resource: workbench.breadcrumbs.getItems()?.at(-1)?.resource },
    );
    expect(workbench.pages.store.getState().activePageId).toBe("tickets");
    expect(workbench.layout.getLayout().regions.main.widgets).toEqual([
      expect.objectContaining({ contributionId: "workbench.page-placement.tickets.%24main" }),
    ]);
  });
});
