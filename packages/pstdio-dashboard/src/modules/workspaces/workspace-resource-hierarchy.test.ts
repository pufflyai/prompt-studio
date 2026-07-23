import { describe, expect, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench/core";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { getSidenavContributionSections } from "@/shared/workbench/contributions/sidenav-tree-contributions";
import { createSidenavModule } from "../sidenav/module";
import { createWorkspacesModule } from "./module";

describe("createWorkspacesModule workspace hierarchy", () => {
  test("projects one selected workspace heading and its canonical children into the resource region", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource(
      "workspace",
      "ps172-workspace",
      "Workspace one",
      "GitBranch",
      "project-1",
      {
        workspaceId: "ps172-workspace",
        workspaceShorthand: "PS-1",
      },
    );

    workbench.registerModule(createSidenavModule());
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    const children = workbench.resources.listChildren(workspace);
    const sections = await getSidenavContributionSections(workbench, "workspace", { resource: workspace });
    const nodes = sections.flatMap((section) => section.nodes);

    expect(children.map((resource) => resource.uri)).toEqual([
      "dashboard-workbench://workspace/ps172-workspace/files",
      "dashboard-workbench://workspace/ps172-workspace/diff",
      "dashboard-workbench://workspace/ps172-workspace/sessions",
    ]);
    expect(new Set(children.map((resource) => resource.uri)).size).toBe(children.length);
    expect(nodes.map((node) => node.label)).toEqual(["Workspace one", "Files", "Diff", "Sessions · 0"]);
    expect(nodes.filter((node) => node.id === `workspace-heading:${workspace.uri}`)).toHaveLength(1);
    for (const child of children) expect(nodes.filter((node) => node.id === child.uri)).toHaveLength(1);
  });

  test("opens a workspace child in Main and extends the workspace breadcrumb", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource(
      "workspace",
      "ps172-workspace",
      "Workspace one",
      "GitBranch",
      "project-1",
      {
        workspaceId: "ps172-workspace",
        workspaceShorthand: "PS-1",
      },
    );

    workbench.registerModule(createSidenavModule());
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    const diff = workbench.resources.listChildren(workspace).find((resource) => resource.kind === "workspace-diff");
    await workbench.resources.openResource(diff!, { replaceActive: true });

    expect(workbench.resources.getParent(diff!)).toEqual(workspace);
    expect(workbench.resources.getResource(diff!.uri)).toEqual(diff);
    expect(workbench.layout.getLayout().regions.main.activeWidgetId).toBe(dashboardWidgetIds.workspace);
    expect(workbench.layout.getLayout().activeResourceUri).toBe(diff!.uri);
    expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual([
      "Workspaces",
      "Workspace one",
      "Diff",
    ]);
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.dashboardSidenav).selectedNodeId).toBe(diff!.uri);
  });

  test("reads the hierarchy once per selected-resource Sidenav transition", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource(
      "workspace",
      "ps172-workspace",
      "Workspace one",
      "GitBranch",
      "project-1",
      {
        workspaceId: "ps172-workspace",
        workspaceShorthand: "PS-1",
      },
    );
    const listChildren = workbench.resources.listChildren;
    let hierarchyReads = 0;
    workbench.resources.listChildren = (resource) => {
      hierarchyReads += 1;
      return listChildren(resource);
    };

    workbench.registerModule(createSidenavModule());
    workbench.registerModule(createWorkspacesModule());

    expect(await getSidenavContributionSections(workbench, "workspace")).toEqual([]);
    expect(hierarchyReads).toBe(0);

    await getSidenavContributionSections(workbench, "workspace", { resource: workspace });
    expect(hierarchyReads).toBe(1);
  });

  test("opens workspace resources in workspace mode", async () => {
    const workbench = createWorkbenchCore();
    const workspace = createDashboardResource("workspace", "ps172-workspace", "PS-307_A1", "GitBranch", "project-1", {
      workspaceId: "ps172-workspace",
      workspaceShorthand: "PS-307_A1",
    });

    workbench.registerModule(createSidenavModule());
    workbench.registerModule(createWorkspacesModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    await workbench.resources.openResource(workspace, { replaceActive: true });

    expect(workbench.modes.getActiveModeId()).toBe("workspace");
    expect(workbench.layout.getLayout().regions.sidenav.widgets.map((widget) => widget.contributionId)).toEqual([
      dashboardWidgetIds.dashboardSidenav,
    ]);
    expect(workbench.layout.getLayout().regions.main.activeWidgetId).toBe(dashboardWidgetIds.workspace);
    expect(workbench.layout.getLayout().regions["main-right-menu"].widgets).toEqual([]);
    expect(workbench.layout.getLayout().activeResourceUri).toBe(workspace.uri);
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.dashboardSidenav).selectedNodeId).toBe(
      "dashboard-workbench://workspace/ps172-workspace/diff",
    );

    const sidenavNodeIds = (
      await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidenav, { resource: workspace })
    )
      .flatMap((section) => section.nodes)
      .map((node) => node.id);
    expect(sidenavNodeIds).toContain(`workspace-heading:${workspace.uri}`);
    expect(sidenavNodeIds).toEqual(
      expect.arrayContaining([
        "dashboard-workbench://workspace/ps172-workspace/files",
        "dashboard-workbench://workspace/ps172-workspace/diff",
        "dashboard-workbench://workspace/ps172-workspace/sessions",
      ]),
    );
    expect(sidenavNodeIds).not.toContain("dashboard-workbench://dashboard-view/sessions");
  });
});
