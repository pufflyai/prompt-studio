import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { treeViewSections } from "@/shared/workbench/workbench-view-test-helpers";
import { registerWorkspaceProviderViews } from "@/workspaces-provider.test-support";
import { createSidenavModule } from "../sidenav/module";
import { createWorkspacesModule } from "../workspaces/module";
import { createSessionsModule } from "./module";
import { registerSessionProvider } from "./session-provider.fixture";

test("workspace navigation queries the installed provider for each workspace and opens sessions in shared Side", async () => {
  const workbench = createWorkbench();
  workbench.registerModule(createSidenavModule());
  registerWorkspaceProviderViews(workbench);
  workbench.registerModule(createWorkspacesModule());
  workbench.registerModule(createSessionsModule());
  const queries: unknown[] = [];
  registerSessionProvider(workbench, {
    sessions: {
      query: async (input) => {
        queries.push(input);
        return {
          items: [
            {
              id: `session-${input?.workspaceId}`,
              title: "Linked",
              status: "completed",
              updatedAt: "2026-06-02T10:00:00Z",
              workspaceId: input?.workspaceId,
            },
          ] as never,
          nextCursor: null,
        };
      },
    },
  });
  selectDashboardProject(workbench, { id: "project-1", name: "Project" });
  for (const id of ["first", "second"]) {
    openWorkspacesPage(workbench, createDashboardResource("workspace", id, id, "GitBranch", "project-1"));
    const sections = await treeViewSections(workbench, dashboardWidgetIds.dashboardSidenav);
    const group = sections.flatMap((section) => section.nodes).find((node) => node.id.endsWith("workspace-sessions"));
    expect(queries.at(-1)).toMatchObject({ workspaceId: id, limit: 50 });
    expect(group?.children?.filter((node) => node.resource).map((node) => node.resource?.id)).toEqual([
      `session-${id}`,
    ]);
    expect(group?.children?.find((node) => node.resource)?.target).toMatchObject({ kind: "panel", open: "preview" });
  }
  workbench.dispose();
});
