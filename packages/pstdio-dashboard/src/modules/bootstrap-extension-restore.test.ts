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
  uri: "dashboard-workbench://project/project-1/extension-views/extension-lab.overview",
  id: "extension-lab.overview",
  label: "Lab overview",
  metadata: { projectId: "project-1" },
} satisfies ResourceRef;

const activeViewId = (workbench: ReturnType<typeof createWorkbenchCore>) => {
  const region = workbench.layout.getLayout().regions.main;
  return region.widgets.find((placement) => placement.widgetId === region.activeWidgetId)?.viewId;
};

const legacyMetadataWithLabView = {
  ...metadataWithLabMode,
  pages: [],
  navigationItems: [],
  views: metadataWithLabMode.views.map((view) => (view.localId === "lab-page" ? { ...view, path: "lab" } : view)),
};

describe("createBootstrapModule extension restores", () => {
  test("keeps legacy extension view URLs working until extensions migrate to pages", async () => {
    let resolveMetadata: (value: typeof legacyMetadataWithLabView) => void = () => undefined;
    const metadataPromise = new Promise<typeof legacyMetadataWithLabView>((resolve) => {
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

      resolveMetadata(legacyMetadataWithLabView);
      await flushMicrotasks();
      await flushMicrotasks();

      expect(activeViewId(workbench)).toBe("pstdio.extension-lab.view.lab-page");
    } finally {
      bootstrap.dispose();
      extensions.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("restores a legacy URL at the persisted cursor without losing Forward history", async () => {
    const viewId = "pstdio.extension-lab.view.lab-page";
    const forwardViewId = "forward-view";
    const persisted: PersistedWorkbenchHistory = {
      version: 2,
      cursor: 0,
      entries: [
        {
          entryId: "lab-history",
          recordedAt: 1,
          kind: "view",
          location: { key: `project:view:${viewId}`, modeId: "project", viewId },
          selectedSubPanels: {},
          modeId: "project",
          viewId,
        },
        {
          entryId: "forward-history",
          recordedAt: 2,
          kind: "view",
          location: { key: `sessions:view:${forwardViewId}`, modeId: "sessions", viewId: forwardViewId },
          selectedSubPanels: {},
          modeId: "sessions",
          viewId: forwardViewId,
        },
      ],
      recentlyClosed: [],
    };
    let resolveMetadata: (value: typeof legacyMetadataWithLabView) => void = () => undefined;
    const metadataPromise = new Promise<typeof legacyMetadataWithLabView>((resolve) => {
      resolveMetadata = resolve;
    });
    const workbench = createWorkbenchCore({
      historyPersistence: {
        getHistory: (scope) => (scope === "project:project-1" ? persisted : undefined),
        setHistory: () => undefined,
      },
    });
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.modes.registerMode({ id: "sessions", label: "Sessions", activate: () => undefined });
    workbench.layout.registerPanel({ id: forwardViewId, title: "Forward", region: "main", rendererId: forwardViewId });
    workbench.views.registerView({ id: forwardViewId, panelId: forwardViewId, title: "Forward" });
    workbench.history.setPersistenceScope("project:project-1");
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
      expect(workbench.history.store.getState().hydrating).toBe(true);

      resolveMetadata(legacyMetadataWithLabView);
      await flushMicrotasks();
      await flushMicrotasks();

      expect(activeViewId(workbench)).toBe(viewId);
      expect(workbench.history.store.getState()).toMatchObject({ cursor: 0, hydrating: false });
      expect(workbench.history.goForward()?.viewId).toBe(forwardViewId);
    } finally {
      bootstrap.dispose();
      extensions.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("restores a resource whose legacy parent view owns the requested URL", async () => {
    const viewId = "pstdio.extension-lab.view.lab-page";
    const resource = {
      kind: "lab-resource",
      uri: "lab-resource:one",
      label: "Lab resource",
    } satisfies ResourceRef;
    const persisted: PersistedWorkbenchHistory = {
      version: 2,
      cursor: 0,
      entries: [
        {
          entryId: "lab-resource-history",
          recordedAt: 1,
          kind: "resource",
          location: { key: `project:resource:${resource.uri}`, modeId: "project", resource },
          selectedSubPanels: {},
          modeId: "project",
          resource,
        },
      ],
      recentlyClosed: [],
    };
    const workbench = createWorkbenchCore({
      historyPersistence: {
        getHistory: (scope) => (scope === "project:project-1" ? persisted : undefined),
        setHistory: () => undefined,
      },
    });
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.layout.registerPanel({ id: viewId, title: "Lab", region: "main", rendererId: viewId });
    workbench.views.registerView({ id: viewId, panelId: viewId, path: "lab", title: "Lab" });
    workbench.resources.registerKind({ kind: resource.kind, label: "Lab resource" });
    workbench.resources.registerPresenter({
      id: "lab-resource-presenter",
      canOpen: (candidate) => candidate.kind === resource.kind,
      open: (candidate) => workbench.layout.openPanel(viewId, { resource: candidate, role: "location" }),
    });
    workbench.resources.registerHierarchyProvider({
      id: "lab-resource-hierarchy",
      canResolve: (candidate) => candidate.kind === resource.kind,
      getParent: () => ({ type: "view", viewId }),
    });
    workbench.history.setPersistenceScope("project:project-1");
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    expect(workbench.resources.walkHierarchy(resource)).toEqual([{ type: "view", viewId }, resource]);
    expect(workbench.history.store.getState().entries[0]?.resource?.uri).toBe(resource.uri);
    const bootstrap = workbench.registerModule(createBootstrapModule({ initialViewPath: "lab" }));

    try {
      await flushMicrotasks();
      await flushMicrotasks();

      expect(workbench.navigator.getSelectedResource()?.uri).toBe(resource.uri);
      expect(workbench.history.store.getState()).toMatchObject({ cursor: 0, hydrating: false });
    } finally {
      bootstrap.dispose();
    }
  });
});

describe("createBootstrapModule extension page restores", () => {
  test("waits for an extension page requested by its initial URL path", async () => {
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
    const bootstrap = workbench.registerModule(createBootstrapModule({ initialViewPath: "pstdio.extension-lab/lab" }));

    try {
      await flushMicrotasks();
      expect(workbench.pages.getActiveLocation()).toBeUndefined();

      resolveMetadata(metadataWithLabMode);
      await flushMicrotasks();
      await flushMicrotasks();

      expect(workbench.pages.getActiveLocation()?.pageId).toBe("pstdio.extension-lab.page.lab");
      expect(workbench.layout.listPanelInstances("main")).toContainEqual(
        expect.objectContaining({ panelId: "pstdio.extension-lab.view.lab-page" }),
      );
    } finally {
      bootstrap.dispose();
      extensions.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("waits for extension views before migrating and restoring the history cursor", async () => {
    const legacyWidgetId = "dashboard-workbench.extension-view.extension-lab.overview";
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

      expect(activeViewId(workbench)).toBe("pstdio.extension-lab.view.overview");
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

      expect(activeViewId(workbench)).toBe("pstdio.extension-lab.view.overview");
      expect(saved).toBeUndefined();
      expect(clearCount).toBe(1);
    } finally {
      bootstrap.dispose();
      extensions.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });
});
