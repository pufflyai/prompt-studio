import { expect, mock, test } from "bun:test";
import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import { createWorkbenchCore, type ResourceRef } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { registerDashboardSidenav } from "@/shared/workbench/dashboard-sidenav";
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
      {
        id: "files",
        label: "Files",
        nodes: [
          {
            id: "research.md",
            label: "research.md",
            target: {
              kind: "command",
              commandId: "pstdio-core-tickets.select-ticket-file",
              args: { ticketId: "PS-10", fileId: "research.md" },
            },
          },
        ],
      },
    ],
  },
} satisfies CommandExecuteResponse;

test("renders a ticket's left tree and mirrors its file selection in the Sidenav", async () => {
  const executeCommand = mock(async (_projectId: string, commandId: string) =>
    commandId === ticketTreeResponse.commandId ? ticketTreeResponse : response,
  );
  const workbench = createWorkbenchCore();

  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
  const sidenavDisposable = registerDashboardSidenav(workbench);
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
    const sidenavSections = await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidenav);

    expect(sidenavSections.map((section) => section.id)).toEqual(["ticket", "files"]);
    expect(workbench.layout.getLayout().regions.sidenav.widgets.map((placement) => placement.contributionId)).toEqual([
      dashboardWidgetIds.dashboardSidenav,
    ]);
    expect(workbench.layout.getLayout().regions["main-left-menu"].widgets).toEqual([]);
    expect(executeCommand).toHaveBeenCalledWith(
      "project-1",
      ticketTreeResponse.commandId,
      expect.objectContaining({ resource: expect.objectContaining({ id: "PS-10", type: "ticket" }) }),
    );

    const fileTarget = sidenavSections.find((section) => section.id === "files")?.nodes[0]?.target;
    expect(fileTarget).toBeDefined();
    await workbench.navigation.openTarget(fileTarget!);

    expect(workbench.renderers.getTreeState("pstdio-core-tickets.ticketFiles").selectedNodeId).toBe("research.md");
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.dashboardSidenav).selectedNodeId).toBe("research.md");
  } finally {
    extensionsDisposable.dispose();
    sidenavDisposable.dispose();
    clearCachedDashboardExtensionMetadata("project-1");
  }
});
