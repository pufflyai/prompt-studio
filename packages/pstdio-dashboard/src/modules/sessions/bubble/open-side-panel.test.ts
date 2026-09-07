import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { createWorkspacesModule } from "../../workspaces/module";
import { createSessionBubbleModule } from "./module";
import { openDashboardSidePanel } from "./open-side-panel";

test("opens an empty chat panel with a workspace session draft and reuses it on reopen", async () => {
  const workbench = createWorkbench({ initialSidePanelMode: "closed" });
  workbench.registerModule(createWorkspacesModule());
  workbench.registerModule(createSessionBubbleModule());
  selectDashboardProject(workbench, { id: "project-1", name: "Project" });
  const workspace = createDashboardResource("workspace", "workspace-1", "Workspace", "GitBranch", "project-1");
  openWorkspacesPage(workbench, workspace);
  const location = workbench.pages.store.getState().location;
  expect(workbench.layout.listPanelInstances("side")).toHaveLength(0);

  await openDashboardSidePanel(workbench);
  const panels = workbench.layout.listPanelInstances("side");
  expect(panels).toHaveLength(1);
  expect(panels[0]).toMatchObject({
    viewId: dashboardWidgetIds.sessionBubble,
    resource: { type: "session-draft", metadata: { workspaceId: "workspace-1" } },
  });
  expect(workbench.sidePanel.getMode()).toBe("floating");
  expect(workbench.pages.store.getState().location).toEqual(location);

  workbench.sidePanel.setMode("closed");
  await openDashboardSidePanel(workbench);
  expect(workbench.layout.listPanelInstances("side")).toEqual(panels);
  expect(workbench.sidePanel.getMode()).toBe("floating");
  expect(workbench.pages.store.getState().location).toEqual(location);
});
