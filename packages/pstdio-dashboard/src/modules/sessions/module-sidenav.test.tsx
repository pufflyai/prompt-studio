import { expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createSidenavModule } from "../sidenav/module";
import { createSessionsModule } from "./module";

test("shows existing sessions immediately on the sessions aggregate", async () => {
  getWriter("sessions")?.truncateAndWrite([
    {
      id: "session-existing",
      project_id: "project-1",
      title: "Existing session",
      status: "completed",
      agent: null,
      last_selected_model: null,
      archived: false,
      created_at: "2026-06-02T10:00:00Z",
      updated_at: "2026-06-02T10:00:00Z",
      deleted_at: null,
    },
  ]);
  const workbench = createWorkbenchCore();

  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
  workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
  workbench.registerModule(createSidenavModule());
  workbench.registerModule(createSessionsModule());

  await workbench.resources.openResource(dashboardResources.sessions);

  const sessionRows = (await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidenav))
    .flatMap((section) => section.nodes)
    .find((node) => node.id === "sessions")?.children;

  expect(sessionRows?.filter((node) => node.resource || node.target).map((node) => node.label)).toEqual([
    "Existing session",
  ]);
});
