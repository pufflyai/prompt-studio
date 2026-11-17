import { expect, test } from "bun:test";
import { contributionRefId, sessionBrowser } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { createHomeModule } from "@/home-page.fixture";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardSessionResource, dashboardHomePage } from "@/shared/app/resources";
import { navigateDashboardPage, openSessionsPage } from "@/shared/workbench/page-navigation";
import { createWorkspacesModule } from "../workspaces/module";
import { createSessionsModule } from "./module";
import { registerSessionProvider } from "./session-provider.fixture";

const fixture = () => {
  const w = createWorkbench({ startPage: dashboardHomePage });
  w.registerModule(createWorkspacesModule());
  w.registerModule(createHomeModule());
  w.registerModule(createSessionsModule());
  registerSessionProvider(w);
  selectDashboardProject(w, { id: "project-1", name: "Project" });
  return w;
};

test("Home and Sessions own tabless Main content while Sessions offers independent viewer tabs", () => {
  const w = fixture();
  navigateDashboardPage(w, { page: dashboardHomePage });
  expect(w.pages.getContent()?.viewId).toBe("test.home");
  expect(w.shell.getPanelPolicy("main").showHeader).toBe(false);
  openSessionsPage(w);
  expect(w.pages.getContent()?.viewId).toBe(contributionRefId(sessionBrowser.views.conversation));
  expect(w.layout.listPanelInstances("main")).toEqual([]);
  expect(w.composition.panelsFor("main").addable).toEqual([]);
  expect(
    w.composition
      .panelsFor("side")
      .addable.some((entry) => entry.contribution.rendererId === contributionRefId(sessionBrowser.views.conversation)),
  ).toBe(true);
});

test("session page navigation replaces Main while a matching panel viewer keeps its owner", async () => {
  const w = fixture();
  const session = (id: string) => createDashboardSessionResource(id, id, "project-1");
  openSessionsPage(w, session("main"));
  openSessionsPage(w, session("next"));
  expect(w.pages.getContent()?.resource?.id).toBe("next");
  expect(w.layout.listPanelInstances("main")).toEqual([]);
  await w.navigation.openPanel({ panel: sessionBrowser.panels.conversation, resource: session("side"), open: "pin" });
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
  navigateDashboardPage(w, { page: dashboardHomePage });
  await w.navigation.openPanel({ panel: sessionBrowser.panels.conversation, resource, open: "pin" });
  await w.commands.executeCommand(dashboardCommandIds.openSessions);
  expect(w.pages.getContent()?.viewId).toBe(contributionRefId(sessionBrowser.views.conversation));
  expect(w.pages.getContent()?.resource).toBeUndefined();
  expect(w.layout.getActivePanel("side")?.resource?.id).toBe("session-x");
});
