import { describe, expect, mock, test } from "bun:test";
import { createWorkbenchCore, type PersistedWorkbenchHistory, type ResourceRef } from "@pstdio/workbench";
import type { DashboardLastResourcePersistence } from "@/shared/app/last-resource-persistence";
import { selectDashboardProject } from "@/shared/app/project-context";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createBootstrapModule } from "./bootstrap";
import { createExtensionsModule } from "./extensions/module";
import { emptyAppearance, flushMicrotasks, metadataWithLabMode } from "./extensions/module-test-fixtures";

const legacyView = {
  kind: "extension-view",
  uri: "dashboard-workbench://project/project-1/extension-views/extension-lab.labOverview",
  id: "extension-lab.labOverview",
  label: "Lab overview",
  metadata: { projectId: "project-1" },
} satisfies ResourceRef;

const activeViewId = (workbench: ReturnType<typeof createWorkbenchCore>) => {
  const region = workbench.layout.getLayout().regions.main;
  return region.widgets.find((placement) => placement.widgetId === region.activeWidgetId)?.viewId;
};

describe("createBootstrapModule extension restores", () => {
  test("waits for an extension view requested by its initial path", async () => {
    let resolveMetadata: (value: typeof metadataWithLabMode) => void = () => undefined;
    const metadataPromise = new Promise<typeof metadataWithLabMode>((resolve) => {
      resolveMetadata = resolve;
    });
    const workbench = createWorkbenchCore();
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const extensions = workbench.registerModule(
      createExtensionsModule({
        loadAppearance: mock(async () => emptyAppearance),
        loadMetadata: mock(() => metadataPromise),
      }),
    );
    const bootstrap = workbench.registerModule(createBootstrapModule({ initialViewPath: "lab" }));

    try {
      await flushMicrotasks();
      expect(activeViewId(workbench)).toBeUndefined();

      resolveMetadata(metadataWithLabMode);
      await flushMicrotasks();

      expect(activeViewId(workbench)).toBe("extension-lab.labPage");
    } finally {
      bootstrap.dispose();
      extensions.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("waits for extension views before migrating and restoring the history cursor", async () => {
    const legacyWidgetId = "dashboard-workbench.extension-view.extension-lab.labOverview";
    const persisted: PersistedWorkbenchHistory = {
      version: 1,
      cursor: 0,
      entries: [
        {
          entryId: "extension-history",
          recordedAt: 1,
          kind: "resource",
          location: {
            key: `project:resource:${legacyView.uri}`,
            modeId: "project",
            resource: legacyView,
            contributionId: legacyWidgetId,
            instanceKey: legacyWidgetId,
            title: legacyView.label,
          },
          selectedSubPanels: {},
          modeId: "project",
          resource: legacyView,
          widgetId: legacyWidgetId,
          contributionId: legacyWidgetId,
          title: legacyView.label,
        },
      ],
      recentlyClosed: [],
    };
    let resolveMetadata: (value: typeof metadataWithLabMode) => void = () => undefined;
    const metadataPromise = new Promise<typeof metadataWithLabMode>((resolve) => {
      resolveMetadata = resolve;
    });
    const workbench = createWorkbenchCore({
      historyPersistence: {
        getHistory: (scope) => (scope === "project:project-1" ? persisted : undefined),
        setHistory: () => undefined,
      },
    });

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.history.setPersistenceScope("project:project-1");
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
      expect(activeViewId(workbench)).toBeUndefined();

      resolveMetadata(metadataWithLabMode);
      await flushMicrotasks();

      expect(activeViewId(workbench)).toBe("extension-lab.labOverview");
      expect(workbench.history.store.getState().cursor).toBe(0);
    } finally {
      bootstrap.dispose();
      extensions.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("opens and clears a delayed legacy last-resource view once", async () => {
    let saved: ResourceRef | undefined = legacyView;
    let clearCount = 0;
    const persistence: DashboardLastResourcePersistence = {
      getLastResource: () => undefined,
      setLastResource: () => undefined,
      getLegacyViewResource: () => saved,
      clearLegacyViewResource: () => {
        clearCount += 1;
        saved = undefined;
      },
    };
    let resolveMetadata: (value: typeof metadataWithLabMode) => void = () => undefined;
    const metadataPromise = new Promise<typeof metadataWithLabMode>((resolve) => {
      resolveMetadata = resolve;
    });
    const workbench = createWorkbenchCore({ lastResourcePersistence: persistence });
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const extensions = workbench.registerModule(
      createExtensionsModule({
        loadAppearance: mock(async () => emptyAppearance),
        loadMetadata: mock(() => metadataPromise),
      }),
    );
    const bootstrap = workbench.registerModule(createBootstrapModule({ lastResourcePersistence: persistence }));

    try {
      await flushMicrotasks();
      expect(activeViewId(workbench)).toBeUndefined();

      resolveMetadata(metadataWithLabMode);
      await flushMicrotasks();

      expect(activeViewId(workbench)).toBe("extension-lab.labOverview");
      expect(saved).toBeUndefined();
      expect(clearCount).toBe(1);
    } finally {
      bootstrap.dispose();
      extensions.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });
});
