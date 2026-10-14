import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openSessionsPage, openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { createWorkspacesModule } from "../../workspaces/module";
import { createSessionsModule } from "../module";
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

test("opens the session draft in the Side Panel while a session page is open", async () => {
  const workbench = createWorkbench({ initialSidePanelMode: "closed" });
  workbench.registerModule(createWorkspacesModule());
  workbench.registerModule(createSessionBubbleModule());
  workbench.registerModule(createSessionsModule());
  selectDashboardProject(workbench, { id: "project-1", name: "Project" });
  openSessionsPage(workbench, createDashboardResource("session", "session-1", "Session", "MessageCircle", "project-1"));
  const location = workbench.pages.store.getState().location;

  await openDashboardSidePanel(workbench);
  expect(workbench.layout.listPanelInstances("side")).toEqual([
    expect.objectContaining({
      viewId: dashboardWidgetIds.sessionBubble,
      resource: expect.objectContaining({ type: "session-draft" }),
    }),
  ]);
  expect(workbench.pages.store.getState().location).toEqual(location);
});
