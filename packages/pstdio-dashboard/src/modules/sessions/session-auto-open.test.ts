import { afterEach, describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createSidenavModule } from "../sidenav/module";
import { createWorkspacesModule } from "../workspaces/module";
import { createSessionBubbleModule } from "./bubble/module";
import { createSessionsModule } from "./module";

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
  const workbench = createWorkbenchCore();

  workbench.registerModule(createSidenavModule());
  workbench.registerModule(createSessionBubbleModule());
  workbench.registerModule(createWorkspacesModule());
  workbench.registerModule(createSessionsModule());
  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
  workbench.sidePanel.setMode("closed");

  return workbench;
};

// Tickets are extension resources; this stands in for the planner's ticket view.
const registerTicketRoute = (workbench: ReturnType<typeof createWorkbenchCore>) => {
  workbench.resources.registerKind({ kind: "ticket", label: "Ticket", icon: "component" });
  workbench.layout.registerPanel({
    id: "test.ticket",
    title: "Ticket",
    region: "main",
    rendererId: "test.ticket",
    singleton: true,
  });
  workbench.resources.registerPresenter({
    id: "test.ticket",
    canOpen: (resource) => resource.kind === "ticket",
    open: (resource) => workbench.layout.openPanel("test.ticket", { resource, strategy: { kind: "persistent" } }),
  });
};

const sidePanelSession = (workbench: ReturnType<typeof createWorkbenchCore>, sessionId: string) =>
  workbench.layout
    .listPanelInstances("side")
    .find((panel) => panel.resource?.uri === `dashboard-workbench://session/${sessionId}`);

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
      .find((entry) => entry.resource.kind === "workspace")?.resource;
    await workbench.resources.openResource(workspace!, { replaceActive: true });

    const session = sidePanelSession(workbench, "session-older");

    expect(workbench.modes.getActiveModeId()).toBe("workspace");
    expect(workbench.layout.getLayout().activeResourceUri).toBe("dashboard-workbench://workspace/workspace-1");
    expect(session?.tabRetention).toBe("preview");
    expect(workbench.layout.getLayout().regions.side.widgets[0]?.widgetId).toBe(session!.instanceId);
    expect(workbench.sidePanel.getMode()).toBe("closed");
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.dashboardSidenav).selectedNodeId).toBe(
      "dashboard-workbench://session/session-older",
    );
  });

  test("opens a ticket's session as a preview, including sessions of its workspaces", async () => {
    const workbench = createSessionWorkbench();
    registerTicketRoute(workbench);

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
    await workbench.resources.openResource(ticket, { replaceActive: true });

    expect(sidePanelSession(workbench, "session-refine")?.tabRetention).toBe("preview");
    expect(sidePanelSession(workbench, "session-unrelated")).toBeUndefined();
  });

  test("leaves the Side Panel alone for a resource without sessions", async () => {
    const workbench = createSessionWorkbench();

    getWriter("workspaces")?.truncateAndWrite([workspaceRow()]);
    getWriter("sessions")?.truncateAndWrite([]);
    getWriter("workspace_sessions")?.truncateAndWrite([]);

    const workspace = workbench.resources
      .listResources("")
      .find((entry) => entry.resource.kind === "workspace")?.resource;
    await workbench.resources.openResource(workspace!, { replaceActive: true });

    expect(workbench.layout.listPanelInstances("side")).toEqual([]);
  });
});
