import { createWorkbenchCore } from "@pstdio/workbench/core";
import { describeResourceRouteContract } from "@pstdio/workbench/testing";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource, dashboardResources } from "@/shared/app/resources";
import { createWorkspacesModule } from "./module";

// The workspaces root and workspace detail are a cross-mode root/detail flow, so
// the route contract only checks identity and single-placement invariants.
describeResourceRouteContract({
  name: "workspaces",
  setup: () => {
    const workbench = createWorkbenchCore();
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    return { workbench };
  },
  root: dashboardResources.workspaces,
  detail: createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
    workspaceId: "workspace-1",
    workspaceShorthand: "PS-307_A1",
  }),
  detailB: createDashboardResource("workspace", "workspace-2", "PS-308_A1", "GitBranch", "project-1", {
    workspaceId: "workspace-2",
    workspaceShorthand: "PS-308_A1",
  }),
  rootDetailHistory: "replaced",
});
