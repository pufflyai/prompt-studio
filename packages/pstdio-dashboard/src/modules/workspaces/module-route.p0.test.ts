import { expect, test } from "bun:test";
import {
  contributionRefId,
  type ResourceRef,
  resourceKey,
  workbenchPages,
  workspacePages,
  workspaceViews,
} from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { canonicalDashboardResource } from "@/shared/extensions/resource-identity";
import { registerWorkspaceProviderViews } from "@/workspaces-provider.test-support";
import { createWorkspacesModule } from "./module";

test("opens the Workspaces view and workspace resources with stable identities", async () => {
  const workbench = createWorkbench();
  try {
    registerWorkspaceProviderViews(workbench);
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.pageLocations.setProject("project-1");
    workbench.pageLocations.navigate({ kind: "page", page: workbenchPages.workspaces });
    expect(workbench.modes.getActiveModeId()).toBe("project");
    const list = workbench.layout
      .getLayout()
      .regions.main.widgets.find((placement) => placement.viewId === contributionRefId(workspaceViews.list));
    expect(list).toBeDefined();
    expect(workbench.getPanelDestinations(list!.widgetId)).toContain("side");
    expect(workbench.getPrimaryResource()).toBeUndefined();
    const workspace = canonicalDashboardResource(
      createDashboardResource("workspace", "workspace-1", "PS-307_A1", "GitBranch", "project-1", {
        workspaceId: "workspace-1",
        workspaceShorthand: "PS-307_A1",
      }),
      "project-1",
    );
    workbench.pageLocations.navigate({ kind: "page", page: workbenchPages.workspace, resource: workspace });
    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(resourceKey(workbench.getPrimaryResource())).toBe(resourceKey(workspace));
  } finally {
    workbench.dispose();
  }
});

const routeCases: { name: string; resource: ResourceRef; page: typeof workspacePages.list }[] = [
  {
    name: "local pointer before metadata",
    resource: { type: "workspace", id: "unhydrated" },
    page: workspacePages.workspace,
  },
  {
    name: "foreign device before metadata",
    resource: {
      type: "workspace",
      id: "foreign",
      device: { id: "other", ownerId: "owner", name: "Other" },
      metadata: { workspaceSupportsFiles: true, workspaceSupportsDiff: true },
    },
    page: workspacePages.history,
  },
  {
    name: "remote execution",
    resource: {
      type: "workspace",
      id: "remote",
      metadata: { workspaceExecutionKind: "remote", workspaceSupportsFiles: true, workspaceSupportsDiff: true },
    },
    page: workspacePages.overview,
  },
  {
    name: "provider without files",
    resource: {
      type: "workspace",
      id: "no-files",
      metadata: { workspaceSupportsFiles: false, workspaceSupportsDiff: true },
    },
    page: workspacePages.overview,
  },
  {
    name: "provider without diff",
    resource: {
      type: "workspace",
      id: "no-diff",
      metadata: { workspaceSupportsFiles: true, workspaceSupportsDiff: false },
    },
    page: workspacePages.files,
  },
];
for (const { name, resource, page } of routeCases) {
  test(`saved workspace links keep supported views for ${name}`, () => {
    const workbench = createWorkbench();
    try {
      registerWorkspaceProviderViews(workbench);
      workbench.registerModule(createWorkspacesModule());
      selectDashboardProject(workbench, { id: "route-project", name: "Routes" });
      workbench.pageLocations.setProject("route-project");
      workbench.pageLocations.navigate({
        kind: "page",
        page: workbenchPages.workspace,
        resource: canonicalDashboardResource(resource, "route-project"),
      });
      expect(workbench.pages.store.getState().location?.page).toEqual(page);
      expect(resourceKey(workbench.getPrimaryResource())).toBe(
        resourceKey(canonicalDashboardResource(resource, "route-project")),
      );
    } finally {
      workbench.dispose();
    }
  });
}
