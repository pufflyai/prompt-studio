import { expect, mock, test } from "bun:test";
import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import { createWorkbenchCore, type ResourceRef } from "@pstdio/workbench/core";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { registerDashboardSidebar } from "@/shared/workbench/dashboard-sidebar";
import { createExtensionsModule } from "./module";
import { flushMicrotasks, metadataWithTickets, response } from "./module-test-fixtures";

const ticketTreeResponse = {
  commandId: "pstdio-core-tickets.ticket-files.tree.body",
  extensionId: "pstdio.pstdio-core-tickets",
  outcome: {
    ok: true,
    status: "success",
    value: [
      { id: "ticket", nodes: [{ id: "ticket-body", label: "PS-10 Ticket" }] },
      { id: "files", label: "Files", nodes: [{ id: "research.md", label: "research.md" }] },
    ],
  },
} satisfies CommandExecuteResponse;

test("renders a ticket's left tree in its Sidebar resource section", async () => {
  const executeCommand = mock(async (_projectId: string, commandId: string) =>
    commandId === ticketTreeResponse.commandId ? ticketTreeResponse : response,
  );
  const workbench = createWorkbenchCore();

  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
  const sidebarDisposable = registerDashboardSidebar(workbench);
  const extensionsDisposable = workbench.registerModule(
    createExtensionsModule({ executeCommand, loadMetadata: mock(async () => metadataWithTickets) }),
  );

  try {
    await flushMicrotasks();
    const ticket = {
      kind: "ticket",
      uri: "dashboard-workbench://ticket/PS-10",
      id: "PS-10",
      label: "PS-10 Ticket",
      metadata: { projectId: "project-1" },
    } satisfies ResourceRef;

    await workbench.resources.openResource(ticket, { replaceActive: true });
    const sidebarSections = await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidebar);

    expect(sidebarSections.map((section) => section.id)).toEqual(["ticket", "files"]);
    expect(workbench.layout.getLayout().regions.sidebar.widgets.map((placement) => placement.contributionId)).toEqual([
      dashboardWidgetIds.dashboardSidebar,
    ]);
    expect(workbench.layout.getLayout().regions["main-left-menu"].widgets).toEqual([]);
    expect(executeCommand).toHaveBeenCalledWith(
      "project-1",
      ticketTreeResponse.commandId,
      expect.objectContaining({ resource: expect.objectContaining({ id: "PS-10", type: "ticket" }) }),
    );
  } finally {
    extensionsDisposable.dispose();
    sidebarDisposable.dispose();
    clearCachedDashboardExtensionMetadata("project-1");
  }
});
