import { expect, mock, test } from "bun:test";
import { createWorkbenchCore } from "@pstdio/workbench";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardResources } from "@/shared/app/resources";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { getSidenavContributionHeaderNodes } from "@/shared/workbench/contributions/sidenav-tree-contributions";
import { registerResourceRoute } from "@/shared/workbench/route-helper";
import { createExtensionKanbanRendererResource } from "./extension-kanban-renderer-resource";
import { createExtensionsModule } from "./module";
import { emptyAppearance, flushMicrotasks, metadata, metadataWithTickets } from "./module-test-fixtures";

test("coalesces same-project metadata churn without starving the first contribution set", async () => {
  const resolvers: Array<(value: typeof metadataWithTickets) => void> = [];
  const loadMetadata = mock(
    () =>
      new Promise<typeof metadataWithTickets>((resolve) => {
        resolvers.push(resolve);
      }),
  );
  const loadAppearance = mock(async () => ({ themes: [], fileIconThemes: [], translations: [], diagnostics: [] }));
  const workbench = createWorkbenchCore();

  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  workbench.modes.setActiveMode("project");
  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
  const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata, loadAppearance }));

  try {
    getWriter("installed_extension_sources")?.upsert({ id: "extension-lab" });
    getWriter("extension_instances")?.upsert({ id: "planner" });
    await flushMicrotasks();

    expect(loadMetadata).toHaveBeenCalledTimes(1);

    resolvers[0]?.(metadataWithTickets);
    await flushMicrotasks();

    expect(getSidenavContributionHeaderNodes(workbench, "project").map((node) => node.label)).toContain("Tickets");
    expect(loadMetadata).toHaveBeenCalledTimes(2);

    resolvers[1]?.(metadataWithTickets);
    await flushMicrotasks();
  } finally {
    disposable.dispose();
    getWriter("installed_extension_sources")?.truncateAndWrite([]);
    getWriter("extension_instances")?.truncateAndWrite([]);
    clearCachedDashboardExtensionMetadata("project-1");
  }
});

test("preserves extension contributions when a same-project metadata refresh fails", async () => {
  let shouldFail = false;
  const loadMetadata = mock(async () => {
    if (shouldFail) throw new Error("Temporary extension metadata failure");
    return metadataWithTickets;
  });
  const workbench = createWorkbenchCore();

  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  workbench.modes.setActiveMode("project");
  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
  const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));

  try {
    await flushMicrotasks();

    expect(workbench.resources.listResources("").some((entry) => entry.resource.id === "lab")).toBe(true);
    expect(workbench.modes.getMode("pstdio-core-tickets.ticket")).toBeDefined();
    expect(getSidenavContributionHeaderNodes(workbench, "project").map((node) => node.label)).toContain("Tickets");

    shouldFail = true;
    getWriter("installed_extension_sources")?.upsert({ id: "extension-lab" });
    await flushMicrotasks();

    expect(workbench.resources.listResources("").some((entry) => entry.resource.id === "lab")).toBe(true);
    expect(workbench.modes.getMode("pstdio-core-tickets.ticket")).toBeDefined();
    expect(getSidenavContributionHeaderNodes(workbench, "project").map((node) => node.label)).toContain("Tickets");
  } finally {
    disposable.dispose();
    getWriter("installed_extension_sources")?.truncateAndWrite([]);
    clearCachedDashboardExtensionMetadata("project-1");
  }
});

test("refreshes an open extension route when metadata changes", async () => {
  const routeWithModuleUrl = (moduleUrl: string) => ({
    ...metadata,
    routes: [
      {
        ...metadata.routes[0]!,
        webview: { ...metadata.routes[0]!.webview, moduleUrl },
      },
    ],
  });
  let nextMetadata = routeWithModuleUrl(
    "/v1/extensions/installed/extension-lab/webviews/extension-lab.labPage/module.js?h=1",
  );
  const loadMetadata = mock(async () => nextMetadata);
  const workbench = createWorkbenchCore();

  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
  const disposable = workbench.registerModule(createExtensionsModule({ loadMetadata }));

  try {
    await flushMicrotasks();

    const labResource = workbench.resources.listResources("").find((entry) => entry.resource.id === "lab")?.resource;
    await workbench.resources.openResource(labResource!);

    nextMetadata = routeWithModuleUrl(
      "/v1/extensions/installed/extension-lab/webviews/extension-lab.labPage/module.js?h=2",
    );
    getWriter("installed_extension_sources")?.upsert({ id: "extension-lab" });
    await flushMicrotasks();

    const placement = workbench.layout.getLayout().regions.main.widgets.find((widget) => widget.resource?.id === "lab");
    expect(placement?.resource?.metadata?.route).toMatchObject({
      webview: expect.objectContaining({
        moduleUrl: "/v1/extensions/installed/extension-lab/webviews/extension-lab.labPage/module.js?h=2",
      }),
    });
  } finally {
    disposable.dispose();
    getWriter("installed_extension_sources")?.truncateAndWrite([]);
    clearCachedDashboardExtensionMetadata("project-1");
  }
});

test("keeps restored Forward navigation stable when appearance resolves after metadata", async () => {
  let resolveAppearance: ((value: typeof emptyAppearance) => void) | undefined;
  const loadAppearance = mock(
    () =>
      new Promise<typeof emptyAppearance>((resolve) => {
        resolveAppearance = resolve;
      }),
  );
  const workbench = createWorkbenchCore();

  workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
  workbench.registerModule({
    id: "test.sessions",
    activate(ctx) {
      ctx.modes.registerMode({ id: "sessions", label: "Sessions", activate: () => undefined });
      ctx.layout.registerPanel({
        closable: false,
        id: "test.sessions.widget",
        title: "Sessions",
        region: "main",
        singleton: true,
        rendererId: "test.sessions.widget",
      });
      registerResourceRoute(ctx, {
        id: "test.sessions.presenter",
        match: (resource) => resource.uri === dashboardResources.sessions.uri,
        mode: "sessions",
        panelId: "test.sessions.widget",
        beforeOpen: () => ctx.breadcrumbs.setItems([{ title: "Sessions", resource: dashboardResources.sessions }]),
      });
      return undefined;
    },
  });
  const disposable = workbench.registerModule(
    createExtensionsModule({ loadAppearance, loadMetadata: mock(async () => metadataWithTickets) }),
  );

  try {
    await flushMicrotasks();
    const tickets = createExtensionKanbanRendererResource(metadataWithTickets.kanbanRenderers[0], "project-1");
    await workbench.resources.openResource(tickets);
    await workbench.resources.openResource(dashboardResources.sessions, { replaceActive: true });
    workbench.history.goBack();

    expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["Tickets"]);

    resolveAppearance?.(emptyAppearance);
    await flushMicrotasks();
    workbench.history.goForward();
    await flushMicrotasks();

    expect(workbench.breadcrumbs.getItems()?.map((item) => item.title)).toEqual(["Sessions"]);
  } finally {
    disposable.dispose();
    clearCachedDashboardExtensionMetadata("project-1");
  }
});
