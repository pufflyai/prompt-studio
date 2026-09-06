import { afterEach, describe, expect, test } from "bun:test";
import { resourceKey } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { createSidenavModule } from "../sidenav/module";
import { createWorkspacesModule } from "../workspaces/module";
import { createSessionBubbleModule } from "./bubble/module";
import { createSessionsModule } from "./module";
import { openResourceSessionPreview } from "./session-auto-open";

const workspaceRow = (overrides: Record<string, unknown> = {}) => ({
  id: "workspace-1",
  project_id: "project-1",
  name: "Dashboard workbench datalayer",
  branch: "workspace/PS-307_A1",
  worktree_path: "/repo/.pstdio/workspaces/PS-307_A1",
  archived: false,
  workspace_shorthand: "PS-307_A1",
  setup_error: null,
  created_at: "2026-05-22T08:10:00Z",
  updated_at: "2026-05-22T08:50:00Z",
  deleted_at: null,
  ...overrides,
});
const sessionRow = (id: string, lastRequestEnded: string, overrides: Record<string, unknown> = {}) => ({
  id,
  project_id: "project-1",
  title: `Session ${id}`,
  status: "completed",
  agent: null,
  last_selected_model: null,
  archived: false,
  last_request_started: lastRequestEnded,
  last_request_ended: lastRequestEnded,
  created_at: "2026-05-22T08:20:00Z",
  updated_at: "2026-05-22T08:20:00Z",
  deleted_at: null,
  ...overrides,
});
const createSessionWorkbench = () => {
  const workbench = createWorkbench();
  workbench.registerModule(createSidenavModule());
  workbench.registerModule(createSessionBubbleModule());
  workbench.registerModule(createWorkspacesModule());
  workbench.registerModule(createSessionsModule());
  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
  workbench.pageLocations.setProject("project-1");
  workbench.sidePanel.setMode("closed");
  return workbench;
};
// Tickets are extension pages; this stands in for the planner's ticket page.
const registerTicketPage = (workbench: ReturnType<typeof createWorkbench>) => {
  const page = { extensionId: "pstdio.planner", kind: "page" as const, id: "ticket" };
  workbench.resources.registerKind({ kind: "ticket", label: "Ticket", icon: "component" });
  workbench.views.registerView({
    id: "test.ticket",
    title: "Ticket",
    body: { kind: "react", render: () => null },
  });
  workbench.pages.registerPage({
    id: "test.ticket",
    ref: page,
    title: "Ticket",
    path: "ticket",
    modeId: "project",
    parentId: "workspaces",
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
        id: "test.ticket",
      },
      cardinality: "one",
    },
    slots: [],
  });
  return page;
};
const sidePanelSession = (workbench: ReturnType<typeof createWorkbench>, sessionId: string) =>
  workbench.layout
    .listPanelInstances("side")
    .find((panel) => panel.resource?.type === "session" && panel.resource.id === sessionId);
// Synced rows are process-wide; leave the tables empty so other suites start clean.
afterEach(() => {
  getWriter("workspaces")?.truncateAndWrite([]);
  getWriter("sessions")?.truncateAndWrite([]);
  getWriter("workspace_sessions")?.truncateAndWrite([]);
});
describe("session auto-open", () => {
  test("opens the last active linked session as a preview when a workspace opens", async () => {
    const workbench = createSessionWorkbench();
    getWriter("workspaces")?.truncateAndWrite([workspaceRow()]);
    getWriter("sessions")?.truncateAndWrite([
      sessionRow("session-older", "2026-05-22T09:45:00Z"),
      sessionRow("session-newer", "2026-05-22T08:35:00Z"),
    ]);
    getWriter("workspace_sessions")?.truncateAndWrite([
      { id: "link-older", workspace_id: "workspace-1", session_id: "session-older" },
      { id: "link-newer", workspace_id: "workspace-1", session_id: "session-newer" },
    ]);
    const workspace = workbench.resources
      .listResources("")
      .find((entry) => entry.resource.type === "workspace")?.resource;
    openWorkspacesPage(workbench, workspace!);
    const session = sidePanelSession(workbench, "session-older");
    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(workbench.layout.getLayout().activeResourceKey).toBe(resourceKey({ type: "workspace", id: "workspace-1" }));
    expect(session?.tabRetention).toBe("preview");
    expect(workbench.layout.getLayout().regions.side.widgets[0]?.widgetId).toBe(session!.instanceId);
    expect(workbench.sidePanel.getMode()).toBe("closed");
    expect(workbench.treeViews.getTreeState(dashboardWidgetIds.dashboardSidenav).selectedNodeId).toBe(
      resourceKey({ type: "session", id: "session-older" }),
    );
  });
  test("opens a ticket's session as a preview, including sessions of its workspaces", async () => {
    const workbench = createSessionWorkbench();
    const ticketPage = registerTicketPage(workbench);
    getWriter("workspaces")?.truncateAndWrite([
      workspaceRow({ anchors_json: [{ type: "ticket", id: "ticket-1", label: "PS-307" }] }),
    ]);
    getWriter("sessions")?.truncateAndWrite([
      sessionRow("session-attempt", "2026-05-22T08:35:00Z"),
      sessionRow("session-refine", "2026-05-22T09:45:00Z", {
        anchors_json: [{ type: "ticket", id: "ticket-1", label: "PS-307" }],
      }),
      sessionRow("session-unrelated", "2026-05-22T10:45:00Z"),
    ]);
    getWriter("workspace_sessions")?.truncateAndWrite([
      { id: "link-attempt", workspace_id: "workspace-1", session_id: "session-attempt" },
    ]);
    const ticket = createDashboardResource("ticket", "ticket-1", "PS-307", "component", "project-1");
    await workbench.navigation.openTarget({ kind: "page", page: ticketPage, resource: ticket });
    expect(sidePanelSession(workbench, "session-refine")?.tabRetention).toBe("preview");
    expect(sidePanelSession(workbench, "session-unrelated")).toBeUndefined();
  });
  test("returns focus to the Location when an active session preview is replaced", async () => {
    const workbench = createSessionWorkbench();
    const ticketPage = registerTicketPage(workbench);
    const ticket = createDashboardResource("ticket", "ticket-1", "PS-307", "component", "project-1");
    getWriter("sessions")?.truncateAndWrite([
      sessionRow("session-old", "2026-05-22T08:35:00Z", {
        anchors_json: [{ type: "ticket", id: "ticket-1", label: "PS-307" }],
      }),
    ]);
    await workbench.navigation.openTarget({ kind: "page", page: ticketPage, resource: ticket });
    workbench.layout.activateWidget(sidePanelSession(workbench, "session-old")!.instanceId);
    getWriter("sessions")?.truncateAndWrite([
      sessionRow("session-new", "2026-05-22T09:45:00Z", {
        anchors_json: [{ type: "ticket", id: "ticket-1", label: "PS-307" }],
      }),
      sessionRow("session-old", "2026-05-22T08:35:00Z", {
        anchors_json: [{ type: "ticket", id: "ticket-1", label: "PS-307" }],
      }),
    ]);
    openResourceSessionPreview(workbench, ticket);
    expect(sidePanelSession(workbench, "session-old")).toBeUndefined();
    expect(sidePanelSession(workbench, "session-new")?.tabRetention).toBe("preview");
    expect(workbench.layout.getLayout().activeWidgetId).toBe(workbench.layout.getLayout().activeLocationWidgetId);
  });
  test("leaves the Side Panel alone for a resource without sessions", async () => {
    const workbench = createSessionWorkbench();
    getWriter("workspaces")?.truncateAndWrite([workspaceRow()]);
    getWriter("sessions")?.truncateAndWrite([]);
    getWriter("workspace_sessions")?.truncateAndWrite([]);
    const workspace = workbench.resources
      .listResources("")
      .find((entry) => entry.resource.type === "workspace")?.resource;
    openWorkspacesPage(workbench, workspace!);
    expect(workbench.layout.listPanelInstances("side")).toEqual([]);
  });
});
