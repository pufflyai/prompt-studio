import { describe, expect, mock, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench/core";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { getSidebarContributionSections } from "@/shared/workbench/contributions/sidebar-tree-contributions";
import { createExtensionsModule } from "./module";
import {
  emptyAppearance,
  flushMicrotasks,
  metadata,
  metadataWithLabMode,
  metadataWithTickets,
} from "./module-test-fixtures";

describe("createExtensionsModule mode layout", () => {
  test("registers extension-lab modes and mounts their extension views", async () => {
    const loadMetadata = mock(async () => metadataWithLabMode);
    const workbench = createWorkbenchCore();

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));

    try {
      await flushMicrotasks();

      expect(workbench.modes.getMode("pstdio.extension-lab.lab")).toMatchObject({ label: "Lab" });

      workbench.modes.setActiveMode("pstdio.extension-lab.lab");

      expect(workbench.layout.getLayout().areas.left.widgets.map((widget) => widget.contributionId)).toEqual([
        "dashboard-workbench.extension-view.extension-lab.labSidebar",
      ]);
      expect(workbench.layout.getLayout().areas.main.widgets.map((widget) => widget.contributionId)).toEqual([
        "dashboard-workbench.extension-view.extension-lab.labOverview",
      ]);
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("reopens a mode-layout extension view in the primary area on history replay", async () => {
    const loadMetadata = mock(async () => metadataWithLabMode);
    const loadAppearance = mock(async () => emptyAppearance);
    const workbench = createWorkbenchCore();

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata, loadAppearance }));

    try {
      await flushMicrotasks();
      workbench.modes.setActiveMode("pstdio.extension-lab.lab");

      const mainResource = workbench.layout.getLayout().areas.main.widgets[0]?.resource;
      expect(mainResource?.kind).toBe("extension-view");

      // Navigate the primary area away, then replay the extension-view entry the way history
      // goBack/goForward does (openResource with replaceActive). Before the view opener existed,
      // this rejected with "No opener registered for resource kind: extension-view".
      workbench.layout.openWidget(dashboardWidgetIds.extensionRoute, { replaceActive: true });
      await workbench.resources.openResource(mainResource!, { replaceActive: true });

      expect(workbench.layout.getLayout().areas.main.widgets.map((widget) => widget.contributionId)).toEqual([
        "dashboard-workbench.extension-view.extension-lab.labOverview",
      ]);
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("does not statically open resource-bound mode layout views", async () => {
    const loadMetadata = mock(async () => metadataWithTickets);
    const workbench = createWorkbenchCore();

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));

    try {
      await flushMicrotasks();

      workbench.modes.setActiveMode("pstdio-core-tickets.ticket");

      expect(workbench.layout.getLayout().areas.left.widgets).toEqual([]);
      expect(workbench.layout.getLayout().areas["main-left"].widgets).toEqual([]);
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("contributes extension tree items only to the project sidebar", async () => {
    const loadMetadata = mock(async () => metadata);
    const workbench = createWorkbenchCore();

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));

    try {
      await flushMicrotasks();

      const projectNodeIds = getSidebarContributionSections(workbench, "project")
        .flatMap((section) => section.nodes)
        .map((node) => node.id);
      const workspaceNodeIds = getSidebarContributionSections(workbench, "workspace")
        .flatMap((section) => section.nodes)
        .map((node) => node.id);

      expect(projectNodeIds).toContain("dashboard-workbench://project/project-1/extensions/lab");
      expect(workspaceNodeIds).not.toContain("dashboard-workbench://project/project-1/extensions/lab");
    } finally {
      disposable.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });
});
