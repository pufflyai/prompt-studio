import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, type TreeViewSection } from "@pstdio/workbench";
import { selectDashboardNavigationResource } from "@/shared/app/navigation-state";
import { dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { registerSidenavContribution } from "./contributions/sidenav-tree-contributions";
import { registerDashboardSidenav } from "./dashboard-sidenav";
import { registerNavigationOwningMode } from "./mode-navigation-ownership";

const settleSidenavSelection = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("registerDashboardSidenav", () => {
  test("keeps the sidenav hidden while a navigation-owning mode is active", () => {
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "lab", label: "Lab", activate: () => undefined });
    workbench.modes.registerMode({ id: "other", label: "Other", activate: () => undefined });
    const ownership = registerNavigationOwningMode("lab");
    registerDashboardSidenav(workbench);

    try {
      workbench.modes.setActiveMode("lab");
      expect(workbench.layout.getLayout().regions.sidenav.widgets).toEqual([]);

      workbench.modes.setActiveMode("other");
      expect(workbench.layout.getLayout().regions.sidenav.widgets.map((widget) => widget.contributionId)).toEqual([
        dashboardWidgetIds.dashboardSidenav,
      ]);
    } finally {
      ownership.dispose();
    }
  });

  test("defaults the Sessions group to expanded", () => {
    const workbench = createWorkbenchCore();

    registerDashboardSidenav(workbench);

    expect(workbench.renderers.getTreeState(dashboardWidgetIds.dashboardSidenav)).toMatchObject({
      expandedNodeIds: ["sessions"],
      expandedSectionIds: ["sessions"],
    });
  });

  test("reads mode sections without a concrete resource and passes one when selected", async () => {
    const workbench = createWorkbenchCore();
    const resourceReads: Array<string | undefined> = [];

    workbench.modes.registerMode({ id: "workspace", label: "Workspace", activate: () => undefined });
    registerSidenavContribution(workbench, {
      id: "test.resource-sections",
      modes: ["workspace"],
      getSections: (_ctx, input) => {
        resourceReads.push(input.resource?.uri);
        return [
          {
            id: "resource",
            nodes: [
              {
                id: input.resource?.uri ?? "aggregate",
                label: input.resource?.label ?? "Aggregate",
              },
            ],
          },
        ];
      },
    });
    registerDashboardSidenav(workbench);
    workbench.modes.setActiveMode("workspace");

    expect(await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidenav)).toEqual([
      { id: "resource", nodes: [{ id: "aggregate", label: "Aggregate" }] },
    ]);
    expect(resourceReads.at(-1)).toBeUndefined();

    const workspace = {
      kind: "workspace",
      uri: "dashboard-workbench://workspace/workspace-1",
      id: "workspace-1",
      label: "Workspace 1",
    };
    selectDashboardNavigationResource(workbench, workspace);

    expect(await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidenav)).toEqual([
      { id: "resource", nodes: [{ id: workspace.uri, label: workspace.label }] },
    ]);
    expect(resourceReads.at(-1)).toBe(workspace.uri);

    selectDashboardNavigationResource(workbench, dashboardResources.workspaces);

    expect(await workbench.renderers.getBody(dashboardWidgetIds.dashboardSidenav)).toEqual([
      { id: "resource", nodes: [{ id: "aggregate", label: "Aggregate" }] },
    ]);
    expect(resourceReads.at(-1)).toBeUndefined();
  });

  test("selects the first visible switch-mode row after its mode becomes active", async () => {
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.modes.registerMode({ id: "lab", label: "Lab", activate: () => undefined });
    registerSidenavContribution(workbench, {
      id: "test.mode-navigation",
      modes: ["*"],
      getSections: () => [
        {
          id: "extensions",
          nodes: [
            {
              id: "run-command",
              label: "Run command",
              target: { kind: "command", commandId: "extension.run", args: { modeId: "lab" } },
            },
            {
              id: "lab-first",
              label: "Lab first",
              target: {
                kind: "command",
                commandId: "workbench.action.switchMode",
                args: { modeId: "lab" },
              },
            },
            {
              id: "lab-second",
              label: "Lab second",
              target: {
                kind: "command",
                commandId: "workbench.action.switchMode",
                args: { modeId: "lab" },
              },
            },
          ],
        },
      ],
    });
    registerDashboardSidenav(workbench);

    workbench.modes.setActiveMode("lab");
    await settleSidenavSelection();

    expect(workbench.renderers.getTreeState(dashboardWidgetIds.dashboardSidenav).selectedNodeId).toBe("lab-first");
  });

  test("does not replace a resource selection while mode selection is loading", async () => {
    const workbench = createWorkbenchCore();
    const selectedNodeIds: Array<string | undefined> = [];
    workbench.renderers.treeStore.subscribeSelector(
      (state) => state.statesByTreeId[dashboardWidgetIds.dashboardSidenav]?.selectedNodeId,
      (selectedNodeId) => selectedNodeIds.push(selectedNodeId),
    );
    let resolveSections: (sections: TreeViewSection[]) => void = () => undefined;
    let markSectionsRequested: () => void = () => undefined;
    const sectionsPromise = new Promise<TreeViewSection[]>((resolve) => {
      resolveSections = resolve;
    });
    const sectionsRequested = new Promise<void>((resolve) => {
      markSectionsRequested = resolve;
    });

    workbench.modes.registerMode({ id: "lab", label: "Lab", activate: () => undefined });
    registerSidenavContribution(workbench, {
      id: "test.delayed-mode-navigation",
      modes: ["*"],
      getSections: () => {
        markSectionsRequested();
        return sectionsPromise;
      },
    });
    registerDashboardSidenav(workbench);

    workbench.modes.setActiveMode("lab");
    await sectionsRequested;
    workbench.renderers.setSelectedNode(dashboardWidgetIds.dashboardSidenav, "resource-row");
    resolveSections([
      {
        id: "extensions",
        nodes: [
          {
            id: "lab",
            label: "Lab",
            target: {
              kind: "command",
              commandId: "workbench.action.switchMode",
              args: { modeId: "lab" },
            },
          },
        ],
      },
    ]);
    await settleSidenavSelection();

    expect(workbench.renderers.getTreeState(dashboardWidgetIds.dashboardSidenav).selectedNodeId).toBe("resource-row");
    expect(selectedNodeIds).toEqual(["resource-row"]);
  });
});

describe("registerDashboardSidenav refresh", () => {
  test("clears a mode-derived selection when leaving without replacing destination selection", async () => {
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.modes.registerMode({ id: "lab", label: "Lab", activate: () => undefined });
    registerSidenavContribution(workbench, {
      id: "test.mode-navigation",
      modes: ["*"],
      getSections: () => [
        {
          id: "extensions",
          nodes: [
            {
              id: "lab",
              label: "Lab",
              target: {
                kind: "command",
                commandId: "workbench.action.switchMode",
                args: { modeId: "lab" },
              },
            },
          ],
        },
      ],
    });
    registerDashboardSidenav(workbench);
    workbench.modes.setActiveMode("lab");
    await settleSidenavSelection();
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.dashboardSidenav).selectedNodeId).toBe("lab");

    workbench.modes.setActiveMode("project");
    await settleSidenavSelection();
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.dashboardSidenav).selectedNodeId).toBeUndefined();

    workbench.modes.setActiveMode("lab");
    await settleSidenavSelection();
    workbench.modes.setActiveMode("project");
    workbench.renderers.setSelectedNode(dashboardWidgetIds.dashboardSidenav, "project-overview");
    await settleSidenavSelection();
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.dashboardSidenav).selectedNodeId).toBe(
      "project-overview",
    );
  });

  test("updates mode selection when sidenav contributions are refreshed", async () => {
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "lab", label: "Lab", activate: () => undefined });
    registerDashboardSidenav(workbench);
    workbench.modes.setActiveMode("lab");
    await settleSidenavSelection();
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.dashboardSidenav).selectedNodeId).toBeUndefined();

    const contribution = registerSidenavContribution(workbench, {
      id: "test.mode-navigation",
      modes: ["*"],
      getSections: () => [
        {
          id: "extensions",
          nodes: [
            {
              id: "lab",
              label: "Lab",
              target: {
                kind: "command",
                commandId: "workbench.action.switchMode",
                args: { modeId: "lab" },
              },
            },
          ],
        },
      ],
    });
    await settleSidenavSelection();
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.dashboardSidenav).selectedNodeId).toBe("lab");

    contribution.dispose();
    await settleSidenavSelection();
    expect(workbench.renderers.getTreeState(dashboardWidgetIds.dashboardSidenav).selectedNodeId).toBeUndefined();
  });
});
