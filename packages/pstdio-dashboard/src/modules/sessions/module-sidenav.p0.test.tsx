import { expect, test } from "bun:test";
import { EnvironmentProvider } from "@chakra-ui/react";
import { contributionRefId, sessionBrowser, sessionBrowserId } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme, TreeList } from "@pstdio/ui";
import { createWorkbench } from "@pstdio/workbench";
import { WorkbenchTreeView } from "@pstdio/workbench/react";
import type { ComponentProps } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { setDashboardExtensionsRegisteredProject } from "@/shared/extensions/extension-readiness";
import { openSessionsPage } from "@/shared/workbench/page-navigation";
import { treeViewBody, treeViewSections } from "@/shared/workbench/workbench-view-test-helpers";
import { createSidenavModule } from "../sidenav/module";
import { createWorkspacesModule } from "../workspaces/module";
import { createSessionsModule } from "./module";
import { registerSessionProvider } from "./session-provider.fixture";

test("switching conversations in Main keeps the loaded Sessions list and selects the new row", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const workbench = createWorkbench();
  let renderer: ReactTestRenderer | undefined;
  let reads = 0;
  const sidenav = dashboardWidgetIds.dashboardSidenav;
  try {
    workbench.modes.registerMode({ id: "project", activate() {} });
    workbench.registerModule(createSidenavModule());
    workbench.registerModule(createSessionsModule());
    registerSessionProvider(workbench, {
      sessions: {
        query: async () => {
          reads++;
          return {
            items: ["First", "Second"].map((title) => ({
              id: title.toLowerCase(),
              title,
              status: "completed",
              updatedAt: "2026-06-02T10:00:00Z",
            })) as never,
            nextCursor: null,
          };
        },
      },
    });
    selectDashboardProject(workbench, { id: "project-1", name: "Project" });
    openSessionsPage(workbench);
    const document = { nodeType: 9, defaultView: {}, getElementById: () => null } as unknown as Document;
    await act(async () => {
      renderer = create(
        <EnvironmentProvider value={() => document}>
          <ChakraProvider value={psTheme}>
            <WorkbenchTreeView workbench={workbench} treeViewId={sidenav} />
          </ChakraProvider>
        </EnvironmentProvider>,
      );
    });
    const sessionList = () =>
      renderer!.root
        .findAllByType(TreeList)
        .map(({ props }) => props as ComponentProps<typeof TreeList>)
        .find(({ sections }) => sections.some((section) => section.nodes.some((node) => node.label === "First")));
    expect(sessionList()).toBeUndefined();
    await act(async () => setDashboardExtensionsRegisteredProject(workbench, "project-1"));
    expect(sessionList()).toBeDefined();
    expect(reads).toBe(1);

    for (const title of ["First", "Second"]) {
      await act(async () => {
        openSessionsPage(workbench, { type: "session", extensionId: "pstdio", id: title.toLowerCase() });
      });
      expect(reads).toBe(1);
      const list = sessionList()!;
      const selected = list.sections.flatMap((section) => section.nodes).find((node) => node.label === title)!;
      expect(list.activeNodeId).toBe(selected.id);
    }
  } finally {
    await act(async () => renderer?.unmount());
    await workbench.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});

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
