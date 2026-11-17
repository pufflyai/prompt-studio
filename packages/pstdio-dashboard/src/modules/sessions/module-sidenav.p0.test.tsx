import { expect, test } from "bun:test";
import { contributionRefId, sessionBrowser, sessionBrowserId } from "@pstdio/sdk/extensions";
import { createWorkbench } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { openSessionsPage } from "@/shared/workbench/page-navigation";
import { treeViewBody, treeViewSections } from "@/shared/workbench/workbench-view-test-helpers";
import { createSidenavModule } from "../sidenav/module";
import { createWorkspacesModule } from "../workspaces/module";
import { createSessionsModule } from "./module";
import { registerSessionProvider } from "./session-provider.fixture";

test("Sessions navigation uses the provider's project list and scopes linked resources to the selected conversation", async () => {
  const workbench = createWorkbench();
  workbench.registerModule(createSidenavModule());
  workbench.registerModule(createWorkspacesModule());
  workbench.registerModule(createSessionsModule());
  registerSessionProvider(workbench, {
    resources: {
      queryAnchors: async ({ resource }) => ({
        items: [
          {
            source: resource,
            target: {
              type: "ticket",
              extensionId: "pstdio.pstdio-planner",
              projectId: "project-1",
              id: `ticket-${resource.id}`,
              label: `Ticket for ${resource.id}`,
            },
          },
        ],
        nextCursor: null,
      }),
      resolveMany: async (refs) =>
        refs.map((resource) => ({
          resource,
          target: {
            kind: "page",
            page: { kind: "page", extensionId: "pstdio.pstdio-planner", id: "ticket" },
            resource,
          },
        })),
    },
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
      .filter((node) => node.resource?.type === "session" && !node.pinnedOnly)
      .map((node) => node.label),
  ).toEqual(["Existing session"]);
  const readKey = () => treeViewBody(workbench, dashboardWidgetIds.dashboardSidenav).getReadKey?.({});
  openSessionsPage(workbench, { type: "session", extensionId: "pstdio", id: "first" });
  const menu = workbench.viewMenus.getViewMenu(
    contributionRefId({ kind: "view-menu", extensionId: sessionBrowserId, id: "session.resources" }),
  )!;
  expect(menu).toMatchObject({ ownerViewId: contributionRefId(sessionBrowser.views.conversation), side: "right" });
  const linkedTickets = async (id: string) =>
    (await treeViewSections(workbench, menu.viewId, { resource: { type: "session", extensionId: "pstdio", id } }))
      .flatMap((section) => section.nodes)
      .filter((node) => node.resource?.type === "ticket")
      .map((node) => node.resource?.id);
  expect(await linkedTickets("first")).toEqual(["ticket-first"]);
  openSessionsPage(workbench, { type: "session", extensionId: "pstdio", id: "second" });
  expect(await linkedTickets("second")).toEqual(["ticket-second"]);
  expect(
    (await treeViewSections(workbench, dashboardWidgetIds.dashboardSidenav))
      .flatMap((section) => section.nodes)
      .filter((node) => node.resource?.type === "session" && !node.pinnedOnly)
      .map((node) => node.label),
  ).toEqual(["Existing session"]);
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
