import { expect, test } from "bun:test";
import { workbenchPages, workbenchPanels } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardSessionResource } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { navigateDashboardPage, openSessionsPage } from "@/shared/workbench/page-navigation";
import { createStartModule } from "../start/module";
import { createWorkspacesModule } from "../workspaces/module";
import { createSessionsModule } from "./module";

const fixture = () => {
  const w = createWorkbench();
  w.registerModule(createWorkspacesModule());
  w.registerModule(createStartModule());
  w.registerModule(createSessionsModule());
  selectDashboardProject(w, { id: "project-1", name: "Project" });
  return w;
};

test("Home and Sessions own tabless Main content while Sessions offers independent viewer tabs", () => {
  const w = fixture();
  navigateDashboardPage(w, { page: workbenchPages.start });
  expect(w.pages.getContent()?.viewId).toBe(dashboardWidgetIds.start);
  expect(w.shell.getPanelPolicy("main").showHeader).toBe(false);
  openSessionsPage(w);
  expect(w.pages.getContent()?.viewId).toBe(dashboardWidgetIds.session);
  expect(w.layout.listPanelInstances("main")).toEqual([]);
  expect(w.composition.panelsFor("main").addable).toEqual([]);
  expect(
    w.composition
      .panelsFor("side")
      .addable.some((entry) => entry.contribution.rendererId === dashboardWidgetIds.sessionBubble),
  ).toBe(true);
});

test("session page navigation replaces Main while a matching panel viewer keeps its owner", async () => {
  const w = fixture();
  const session = (id: string) => createDashboardSessionResource(id, id, "project-1");
  openSessionsPage(w, session("main"));
  openSessionsPage(w, session("next"));
  expect(w.pages.getContent()?.resource?.id).toBe("next");
  expect(w.layout.listPanelInstances("main")).toEqual([]);
  await w.navigation.openPanel({ panel: workbenchPanels.projectSession, resource: session("side"), open: "pin" });
  const side = w.layout.getActivePanel("side")!;
  const location = w.pages.store.getState().location;
  openSessionsPage(w, session("side"));
  expect(w.layout.getActivePanel("side")?.instanceId).toBe(side.instanceId);
  expect(w.pages.store.getState().location).toBe(location);
});

test("returning to Sessions uses its landing when Side now owns the remembered session", async () => {
  const w = fixture();
  const resource = createDashboardSessionResource("session-x", "Session X", "project-1");
  openSessionsPage(w, resource);
  navigateDashboardPage(w, { page: workbenchPages.start });
  await w.navigation.openPanel({ panel: workbenchPanels.projectSession, resource, open: "pin" });
  await w.commands.executeCommand(dashboardCommandIds.openSessions);
  expect(w.pages.getContent()?.viewId).toBe(dashboardWidgetIds.session);
  expect(w.pages.getContent()?.resource).toBeUndefined();
  expect(w.layout.getActivePanel("side")?.resource?.id).toBe("session-x");
});
