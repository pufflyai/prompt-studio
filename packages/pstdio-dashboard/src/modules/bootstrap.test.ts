import { describe, expect, mock, test } from "bun:test";
import { createWorkbenchCore, type ResourceRef } from "pstdio-workbench/core";
import { getWriter, markInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardResources } from "@/shared/app/resources";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createBootstrapModule } from "./bootstrap";
import { createDashboardViewsModule } from "./dashboard-views/module";
import { createExtensionsModule } from "./extensions/module";
import { emptyAppearance, flushMicrotasks, metadataWithTickets } from "./extensions/module-test-fixtures";
import { createStartModule } from "./start/module";
import { createWorkspacesModule } from "./workspaces/module";

describe("createBootstrapModule", () => {
  test("opens the start view when a selected project has no saved location", async () => {
    const workbench = createWorkbenchCore();

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    for (const resource of [dashboardResources.start, dashboardResources.workspaces]) {
      const widgetId = `test.${resource.id}`;
      workbench.layout.registerWidget({
        id: widgetId,
        title: resource.label ?? resource.id,
        area: "main",
        rendererId: widgetId,
        singleton: true,
      });
      workbench.resources.registerOpener({
        id: widgetId,
        canOpen: (candidate) => candidate.uri === resource.uri,
        open: (candidate) => workbench.layout.openWidget(widgetId, { resource: candidate }),
      });
    }
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    const bootstrap = workbench.registerModule(createBootstrapModule());

    try {
      await flushMicrotasks();

      expect(workbench.getPrimaryResource()?.uri).toBe(dashboardResources.start.uri);
    } finally {
      bootstrap.dispose();
    }
  });

  test("restores an extension resource after extension metadata has registered its opener", async () => {
    const ticket = {
      kind: "ticket",
      uri: "dashboard-workbench://ticket/PS-10",
      id: "PS-10",
      label: "PS-10 Ticket",
      metadata: { projectId: "project-1" },
    } satisfies ResourceRef;
    let savedResource: ResourceRef | undefined = ticket;
    let resolveMetadata: (value: typeof metadataWithTickets) => void = () => undefined;
    const metadataPromise = new Promise<typeof metadataWithTickets>((resolve) => {
      resolveMetadata = resolve;
    });
    const workbench = createWorkbenchCore({
      lastResourcePersistence: {
        getLastResource: () => savedResource,
        setLastResource: (resource) => {
          savedResource = resource;
        },
      },
    });

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    workbench.layout.registerWidget({
      id: dashboardWidgetIds.workspaces,
      title: "Workspaces",
      area: "main",
      rendererId: "test.workspaces",
      singleton: true,
    });
    workbench.resources.registerOpener({
      id: "test.workspaces",
      canOpen: (resource) => resource.kind === "dashboard-view" && resource.id === dashboardResources.workspaces.id,
      open: (resource) => workbench.layout.openWidget(dashboardWidgetIds.workspaces, { resource }),
    });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const extensions = workbench.registerModule(
      createExtensionsModule({
        loadAppearance: mock(async () => emptyAppearance),
        loadMetadata: mock(() => metadataPromise),
      }),
    );
    const bootstrap = workbench.registerModule(createBootstrapModule());

    try {
      await flushMicrotasks();

      expect(workbench.getPrimaryResource()?.uri).not.toBe(dashboardResources.workspaces.uri);

      resolveMetadata(metadataWithTickets);
      await flushMicrotasks();

      expect(workbench.getPrimaryResource()?.uri).toBe(ticket.uri);
    } finally {
      bootstrap.dispose();
      extensions.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("waits for initial sync before restoring a saved workspace", async () => {
    let savedResource: ResourceRef | undefined = {
      kind: "workspace",
      uri: "dashboard-workbench://workspace/deleted-workspace",
      id: "deleted-workspace",
      label: "Deleted workspace",
      metadata: { projectId: "project-1" },
    };
    const workbench = createWorkbenchCore({
      lastResourcePersistence: {
        getLastResource: () => savedResource,
        setLastResource: (resource) => {
          savedResource = resource;
        },
      },
    });

    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const dashboardViews = workbench.registerModule(createDashboardViewsModule());
    const workspaces = workbench.registerModule(createWorkspacesModule());
    const start = workbench.registerModule(createStartModule());
    const bootstrap = workbench.registerModule(createBootstrapModule());

    try {
      getWriter("workspaces")?.truncateAndWrite([]);
      markInitialCollectionsSyncComplete();
      await flushMicrotasks();

      expect(workbench.getPrimaryResource()?.uri).toBe(dashboardResources.start.uri);
      expect(savedResource?.uri).toBe(dashboardResources.start.uri);
    } finally {
      bootstrap.dispose();
      start.dispose();
      workspaces.dispose();
      dashboardViews.dispose();
    }
  });
});
