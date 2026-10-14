import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardResource } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openSessionsPage, openWorkspacesPage } from "@/shared/workbench/page-navigation";
import { createWorkspacesModule } from "../../workspaces/module";
import { createSessionsModule } from "../module";
import { createSessionBubbleModule } from "./module";

const create = () =>
  createWorkbench({
    initialSidePanelMode: "closed",
    floating: {
      defaultTab: {
        kind: "command",
        commandId: dashboardCommandIds.createSession,
        args: { sidePanel: true },
      },
    },
  });

test("opens an empty chat panel with a workspace session draft and reuses it on reopen", async () => {
  const workbench = create();
  workbench.registerModule(createWorkspacesModule());
  workbench.registerModule(createSessionBubbleModule());
  selectDashboardProject(workbench, { id: "project-1", name: "Project" });
  const workspace = createDashboardResource("workspace", "workspace-1", "Workspace", "GitBranch", "project-1");
  openWorkspacesPage(workbench, workspace);
  const location = workbench.pages.store.getState().location;
  expect(workbench.layout.listPanelInstances("side")).toHaveLength(0);

  await workbench.shell.setRegionOpen("side", true, "floating");
  const panels = workbench.layout.listPanelInstances("side");
  expect(panels).toHaveLength(1);
  expect(panels[0]).toMatchObject({
    viewId: dashboardWidgetIds.sessionBubble,
    resource: { type: "session-draft", metadata: { workspaceId: "workspace-1" } },
  });
  expect(workbench.sidePanel.getMode()).toBe("floating");
  expect(workbench.pages.store.getState().location).toEqual(location);

  workbench.sidePanel.setMode("closed");
  await workbench.shell.setRegionOpen("side", true, "floating");
  expect(workbench.layout.listPanelInstances("side")).toEqual(panels);
  expect(workbench.sidePanel.getMode()).toBe("floating");
  expect(workbench.pages.store.getState().location).toEqual(location);
});

test("floating default creates a Side draft while the Sessions page stays selected", async () => {
  const core = create();
  core.registerModule(createWorkspacesModule());
  core.registerModule(createSessionsModule());
  core.registerModule(createSessionBubbleModule());
  selectDashboardProject(core, { id: "floating-project", name: "Floating" });
  await openSessionsPage(core);
  const location = core.pages.store.getState().location;
  await core.shell.setRegionOpen("side", true, "floating");
  expect(core.layout.listPanelInstances("side")).toHaveLength(1);
  expect(core.layout.listPanelInstances("side")[0]?.resource?.type).toBe("session-draft");
  expect(core.pages.store.getState().location).toEqual(location);
  expect(core.sidePanel.getMode()).toBe("floating");
  await core.dispose();
});

test("opens the session draft in the Side Panel while a session page is open", async () => {
  const workbench = create();
  workbench.registerModule(createWorkspacesModule());
  workbench.registerModule(createSessionBubbleModule());
  workbench.registerModule(createSessionsModule());
  selectDashboardProject(workbench, { id: "project-1", name: "Project" });
  await openSessionsPage(
    workbench,
    createDashboardResource("session", "session-1", "Session", "MessageCircle", "project-1"),
  );
  const location = workbench.pages.store.getState().location;

  await workbench.shell.setRegionOpen("side", true, "floating");
  expect(workbench.layout.listPanelInstances("side")).toEqual([
    expect.objectContaining({
      viewId: dashboardWidgetIds.sessionBubble,
      resource: expect.objectContaining({ type: "session-draft" }),
    }),
  ]);
  expect(workbench.pages.store.getState().location).toEqual(location);
});
