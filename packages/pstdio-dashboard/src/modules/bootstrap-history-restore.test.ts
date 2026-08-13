import { describe, expect, mock, test } from "bun:test";
import { createWorkbenchCore, type PersistedWorkbenchHistory } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardResources } from "@/shared/app/resources";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createBootstrapModule } from "./bootstrap";
import { createExtensionsModule } from "./extensions/module";
import { emptyAppearance, flushMicrotasks, type metadataWithLabMode } from "./extensions/module-test-fixtures";

describe("createBootstrapModule history restore", () => {
  test("restores built-in history without waiting for extension contributions", async () => {
    const resource = dashboardResources.workspaces;
    const widgetId = "test.workspaces";
    const persisted: PersistedWorkbenchHistory = {
      version: 1,
      cursor: 0,
      entries: [
        {
          entryId: "workspaces-history",
          recordedAt: 1,
          kind: "resource",
          location: {
            key: `project:resource:${resource.uri}`,
            modeId: "project",
            resource,
            contributionId: widgetId,
            instanceKey: widgetId,
            title: resource.label,
          },
          selectedSubPanels: {},
          modeId: "project",
          resource,
          widgetId,
          contributionId: widgetId,
          title: resource.label,
        },
      ],
      recentlyClosed: [],
    };
    const neverReady = new Promise<typeof metadataWithLabMode>(() => undefined);
    const workbench = createWorkbenchCore({
      historyPersistence: {
        getHistory: (scope) => (scope === "project:project-1" ? persisted : undefined),
        setHistory: () => undefined,
      },
    });

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.resources.registerKind({ kind: "dashboard-view", label: "Dashboard view" });
    workbench.layout.registerPanel({
      id: widgetId,
      title: "Workspaces",
      region: "main",
      rendererId: widgetId,
      singleton: true,
    });
    workbench.resources.registerPresenter({
      id: widgetId,
      canOpen: (candidate) => candidate.uri === resource.uri,
      open: (candidate) => workbench.layout.openPanel(widgetId, { resource: candidate }),
    });
    workbench.history.setPersistenceScope("project:project-1");
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const extensions = workbench.registerModule(
      createExtensionsModule({
        loadAppearance: mock(async () => emptyAppearance),
        loadMetadata: mock(() => neverReady),
      }),
    );
    const bootstrap = workbench.registerModule(createBootstrapModule());

    try {
      await flushMicrotasks();

      expect(workbench.getPrimaryResource()?.uri).toBe(resource.uri);
      expect(workbench.history.store.getState().hydrating).toBe(false);
    } finally {
      bootstrap.dispose();
      extensions.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });
});
