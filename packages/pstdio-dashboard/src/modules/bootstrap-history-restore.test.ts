import { describe, expect, mock, test } from "bun:test";
import { createWorkbenchCore, type PersistedWorkbenchHistory } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardViews } from "@/shared/app/resources";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createBootstrapModule } from "./bootstrap";
import { createExtensionsModule } from "./extensions/module";
import { emptyAppearance, flushMicrotasks, type metadataWithLabMode } from "./extensions/module-test-fixtures";

describe("createBootstrapModule history restore", () => {
  test("restores a built-in view without waiting for extension contributions", async () => {
    const widgetId = "test.workspaces";
    const persisted: PersistedWorkbenchHistory = {
      version: 1,
      cursor: 0,
      entries: [
        {
          entryId: "workspaces-history",
          recordedAt: 1,
          kind: "view",
          location: {
            key: `project:view:${dashboardViews.workspaces.id}`,
            modeId: "project",
            viewId: dashboardViews.workspaces.id,
            contributionId: widgetId,
            instanceKey: widgetId,
            title: dashboardViews.workspaces.label,
          },
          selectedSubPanels: {},
          modeId: "project",
          viewId: dashboardViews.workspaces.id,
          widgetId,
          contributionId: widgetId,
          title: dashboardViews.workspaces.label,
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
    workbench.layout.registerPanel({ id: widgetId, title: "Workspaces", region: "main", rendererId: widgetId });
    workbench.views.registerView({
      id: dashboardViews.workspaces.id,
      panelId: widgetId,
      title: dashboardViews.workspaces.label,
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
      const placement = workbench.layout.getLayout().regions.main.widgets[0];
      expect(placement?.viewId).toBe(dashboardViews.workspaces.id);
      expect(workbench.history.store.getState().hydrating).toBe(false);
    } finally {
      bootstrap.dispose();
      extensions.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });
});
