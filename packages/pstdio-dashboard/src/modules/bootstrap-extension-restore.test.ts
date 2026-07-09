import { describe, expect, mock, test } from "bun:test";
import { createWorkbenchCore, type ResourceRef } from "@pstdio/workbench/core";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardResources } from "@/shared/app/resources";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createBootstrapModule } from "./bootstrap";
import { createExtensionsModule } from "./extensions/module";
import { emptyAppearance, flushMicrotasks, metadata, metadataWithLabMode } from "./extensions/module-test-fixtures";
import { createStartModule } from "./start/module";

describe("createBootstrapModule extension restores", () => {
  test("waits for delayed extension-view metadata before falling back to start", async () => {
    const extensionView = {
      kind: "extension-view",
      uri: "dashboard-workbench://project/project-1/extension-views/extension-lab.labOverview",
      id: "extension-lab.labOverview",
      label: "Lab overview",
      metadata: { projectId: "project-1" },
    } satisfies ResourceRef;
    let savedResource: ResourceRef | undefined = extensionView;
    let resolveMetadata: (value: typeof metadataWithLabMode) => void = () => undefined;
    const metadataPromise = new Promise<typeof metadataWithLabMode>((resolve) => {
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
    const dashboardViewKind = workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const start = workbench.registerModule(createStartModule());
    const extensions = workbench.registerModule(
      createExtensionsModule({
        loadAppearance: mock(async () => emptyAppearance),
        loadMetadata: mock(() => metadataPromise),
      }),
    );
    const bootstrap = workbench.registerModule(createBootstrapModule());

    try {
      await flushMicrotasks();

      expect(workbench.getPrimaryResource()?.uri).not.toBe(dashboardResources.start.uri);
      expect(savedResource?.uri).toBe(extensionView.uri);

      resolveMetadata(metadataWithLabMode);
      await flushMicrotasks();

      expect(workbench.getPrimaryResource()?.uri).toBe(extensionView.uri);
      expect(savedResource?.uri).toBe(extensionView.uri);
    } finally {
      bootstrap.dispose();
      extensions.dispose();
      start.dispose();
      dashboardViewKind.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("falls back to start when a saved extension route is no longer available", async () => {
    const deletedRoute = {
      kind: "extension-route",
      uri: "dashboard-workbench://project/project-1/extensions/deleted",
      id: "deleted",
      label: "Deleted route",
      metadata: { projectId: "project-1", routePath: "deleted" },
    } satisfies ResourceRef;
    let savedResource: ResourceRef | undefined = deletedRoute;
    const workbench = createWorkbenchCore({
      lastResourcePersistence: {
        getLastResource: () => savedResource,
        setLastResource: (resource) => {
          savedResource = resource;
        },
      },
    });

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    const dashboardViewKind = workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const start = workbench.registerModule(createStartModule());
    const extensions = workbench.registerModule(
      createExtensionsModule({
        loadAppearance: mock(async () => emptyAppearance),
        loadMetadata: mock(async () => metadata),
      }),
    );
    const bootstrap = workbench.registerModule(createBootstrapModule());

    try {
      await flushMicrotasks();
      await flushMicrotasks();

      expect(workbench.getPrimaryResource()?.uri).toBe(dashboardResources.start.uri);
      expect(savedResource?.uri).toBe(dashboardResources.start.uri);
    } finally {
      bootstrap.dispose();
      extensions.dispose();
      start.dispose();
      dashboardViewKind.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });
});
