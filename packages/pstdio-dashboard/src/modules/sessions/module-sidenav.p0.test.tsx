import { expect, test } from "bun:test";
import { createWorkbench } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openSessionsPage } from "@/shared/workbench/page-navigation";
import { treeViewBody, treeViewSections } from "@/shared/workbench/workbench-view-test-helpers";
import { createSidenavModule } from "../sidenav/module";
import { createWorkspacesModule } from "../workspaces/module";
import { createSessionsModule } from "./module";
import { registerSessionProvider } from "./session-provider.fixture";

test("Sessions navigation uses the provider's project list and keeps its scope across conversation selection", async () => {
  const workbench = createWorkbench();
  workbench.registerModule(createSidenavModule());
  workbench.registerModule(createWorkspacesModule());
  workbench.registerModule(createSessionsModule());
  registerSessionProvider(workbench, {
    sessions: {
      query: async () => ({
        items: [
          { id: "saved", title: "Existing session", status: "completed", updatedAt: "2026-06-02T10:00:00Z" },
        ] as never,
        nextCursor: null,
      }),
    },
  });
  selectDashboardProject(workbench, { id: "project-1", name: "Project" });
  openSessionsPage(workbench);
  const sections = await treeViewSections(workbench, dashboardWidgetIds.dashboardSidenav);
  expect(
    sections
      .flatMap((section) => section.nodes)
      .filter((node) => node.resource?.type === "session")
      .map((node) => node.label),
  ).toEqual(["Existing session"]);
  const readKey = () => treeViewBody(workbench, dashboardWidgetIds.dashboardSidenav).getReadKey?.({});
  openSessionsPage(workbench, { type: "session", extensionId: "pstdio", id: "first" });
  const first = readKey();
  openSessionsPage(workbench, { type: "session", extensionId: "pstdio", id: "second" });
  expect(readKey()).toBe(first);
  workbench.navigationTrees.registerContribution({
    id: "extension.session-actions",
    owner: { kind: "mode", id: "project", extensionId: "pstdio" },
    sourceExtensionId: "extension",
    declarationIndex: 0,
    getSections: () => [],
  });
  const dependent = readKey();
  openSessionsPage(workbench, { type: "session", extensionId: "pstdio", id: "first" });
  expect(readKey()).not.toBe(dependent);
  workbench.dispose();
});
