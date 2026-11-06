import { expect, test } from "bun:test";
import { contributionRefId, sessionBrowser } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { dashboardSelectedProjectIdContextKey, selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardSessionResource } from "@/shared/app/resources";
import { openSessionsPage } from "@/shared/workbench/page-navigation";
import { createWorkspacesModule } from "../workspaces/module";
import { createSessionsModule } from "./module";
import { registerSessionProvider } from "./session-provider.fixture";

const fixture = () => {
  const workbench = createWorkbench();
  workbench.registerModule(createWorkspacesModule());
  workbench.registerModule(createSessionsModule());
  registerSessionProvider(workbench);
  selectDashboardProject(workbench, { id: "project-1", name: "Project" });
  return workbench;
};
test("provider session pages retain canonical identity, breadcrumbs and tabless Main replacement", () => {
  const workbench = fixture();
  const first = createDashboardSessionResource("first", "First", "project-1");
  const second = createDashboardSessionResource("second", "Second", "project-1");
  expect(workbench.resources.getKind("session")).toMatchObject({ label: "Session" });
  openSessionsPage(workbench, first);
  expect(workbench.pages.store.getState().location?.page).toEqual(sessionBrowser.pages.session);
  expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["Sessions", "First"]);
  openSessionsPage(workbench, second);
  expect(workbench.pages.getContent()?.resource).toMatchObject(second);
  expect(workbench.pages.getContent()?.viewId).toBe(contributionRefId(sessionBrowser.views.conversation));
  expect(workbench.layout.listPanelInstances("main")).toHaveLength(0);
  workbench.dispose();
});
test("session history returns to the composer and forward to its canonical conversation", async () => {
  const workbench = fixture();
  openSessionsPage(workbench);
  openSessionsPage(workbench, createDashboardSessionResource("saved", "Saved", "project-1"));
  workbench.pageLocations.goBack();
  await Promise.resolve();
  expect(workbench.pages.store.getState().location?.page).toEqual(sessionBrowser.pages.compose);
  expect(workbench.pages.getContent()?.resource).toBeUndefined();
  workbench.pageLocations.goForward();
  await Promise.resolve();
  expect(workbench.pages.getContent()?.resource).toMatchObject({ type: "session", extensionId: "pstdio", id: "saved" });
  workbench.dispose();
});
test("global Sessions navigation establishes the selected project before opening its landing", async () => {
  const workbench = fixture();
  workbench.context.set(dashboardSelectedProjectIdContextKey, "project-1");
  workbench.pageLocations.clearProject();
  await workbench.commands.executeCommand(dashboardCommandIds.openSessions);
  expect(workbench.pages.store.getState().projectId).toBe("project-1");
  expect(workbench.pages.store.getState().location?.page).toEqual(sessionBrowser.pages.compose);
  workbench.dispose();
});
test("legacy create enters the provider draft page and keeps Side independent", async () => {
  const workbench = fixture();
  openSessionsPage(workbench, createDashboardSessionResource("saved", "Saved", "project-1"));
  await workbench.commands.executeCommand(dashboardCommandIds.createSession);
  expect(workbench.pages.store.getState().location?.page).toEqual(sessionBrowser.pages.draft);
  expect(workbench.pages.getContent()?.resource).toMatchObject({ type: "session-draft", extensionId: "pstdio" });
  expect(workbench.layout.listPanelInstances("side")).toHaveLength(0);
  workbench.dispose();
});
