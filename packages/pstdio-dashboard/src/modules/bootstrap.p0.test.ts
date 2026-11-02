import { describe, expect, mock, test } from "bun:test";
import { createWorkbench, type WorkbenchPageLocationBrowser } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { setDashboardExtensionsReadyProject } from "@/shared/extensions/extension-readiness";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { resolveDashboardPersistenceScope } from "@/shared/workbench/dashboard-persistence-scope";
import { createBootstrapModule } from "./bootstrap";
import { createExtensionsModule } from "./extensions/module";
import { emptyAppearance, flushMicrotasks, metadata } from "./extensions/module-test-fixtures";
import { createStartModule } from "./start/start-page.fixture";

const activeViewId = (workbench: ReturnType<typeof createWorkbench>) => {
  const region = workbench.layout.getLayout().regions.main;
  return region.widgets.find((placement) => placement.widgetId === region.activeWidgetId)?.viewId;
};

const browserAt = (url: string): WorkbenchPageLocationBrowser => {
  let current = { url };
  return {
    current: () => current,
    push: (entry) => {
      current = entry;
    },
    replace: (entry) => {
      current = entry;
    },
    back: () => undefined,
    forward: () => undefined,
    onPopState: () => ({ dispose: () => undefined }),
  };
};

describe("createBootstrapModule", () => {
  test("waits for project landing contributions before opening the fallback Start page", async () => {
    const workbench = createWorkbench();
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const start = workbench.registerModule(createStartModule());
    const bootstrap = workbench.registerModule(createBootstrapModule());

    try {
      await flushMicrotasks();
      expect(workbench.pages.store.getState().activePageId).toBeUndefined();

      setDashboardExtensionsReadyProject(workbench, "project-1");
      await flushMicrotasks();
      expect(workbench.pages.store.getState().activePageId).toBe("start");
    } finally {
      bootstrap.dispose();
      start.dispose();
    }
  });

  test("does not open project selection while a persisted project is still loading", () => {
    const workbench = createWorkbench();
    workbench.modes.registerMode({ id: "project-selection", label: "Projects", activate: () => undefined });

    const bootstrap = workbench.registerModule(
      createBootstrapModule({
        isInitialSyncComplete: () => false,
        projectSelectionPersistence: {
          getSelectedProjectId: () => "project-1",
          setSelectedProjectId: () => undefined,
        },
      }),
    );

    try {
      expect(workbench.modes.getActiveModeId()).toBeUndefined();
    } finally {
      bootstrap.dispose();
    }
  });

  for (const navigateAway of [false, true]) {
    test(`restores a delayed extension URL unless the user navigates first (${navigateAway})`, async () => {
      const loading = Promise.withResolvers<typeof metadata>();
      const browser = browserAt("/projects/project-1/extensions/pstdio.extension-lab/lab");
      const workbench = createWorkbench({
        pageLocationBrowser: browser,
      });
      workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
      selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
      const start = workbench.registerModule(createStartModule());
      const extensions = workbench.registerModule(
        createExtensionsModule({
          loadAppearance: mock(async () => emptyAppearance),
          loadMetadata: () => loading.promise,
        }),
      );
      const bootstrap = workbench.registerModule(createBootstrapModule());

      try {
        await flushMicrotasks();
        expect(browser.current().url).toBe("/projects/project-1/extensions/pstdio.extension-lab/lab");
        expect(workbench.pages.store.getState().activePageId).toBeUndefined();
        expect(workbench.modes.getActiveModeId()).toBe("project");
        if (navigateAway)
          workbench.pageLocations.navigate({
            kind: "page",
            page: { extensionId: "pstdio", kind: "page", id: "start" },
          });
        loading.resolve(metadata);
        await flushMicrotasks();
        await flushMicrotasks();
        if (navigateAway) expect(workbench.pages.store.getState().activePageId).toBe("start");
        else expect(activeViewId(workbench)).toBe("pstdio.extension-lab.view.labPage");
      } finally {
        bootstrap.dispose();
        extensions.dispose();
        start.dispose();
        clearCachedDashboardExtensionMetadata("project-1");
      }
    });
  }
});

for (const withStart of [false, true])
  test(`delayed landing wins over fallback pages (host Start: ${withStart})`, async () => {
    const workbench = createWorkbench({ pageLocationBrowser: browserAt("/projects/project-1") });
    workbench.modes.registerMode({ id: "project", activate: () => undefined });
    selectDashboardProject(workbench, { id: "project-1", name: "Project" });
    if (withStart) workbench.registerModule(createStartModule());
    workbench.pages.registerPage({
      id: "tools",
      ref: { kind: "page", extensionId: "pstdio", id: "tools" },
      path: "tools",
      modeId: "project",
      main: { kind: "panels" },
      slots: [],
    });
    const bootstrap = workbench.registerModule(createBootstrapModule());
    expect(workbench.pages.store.getState().activePageId).toBeUndefined();
    expect(workbench.layout.getPlaceholder("main")).toBeDefined();
    const home = { kind: "page" as const, extensionId: "acme.home", id: "home" };
    workbench.pages.registerPage({
      id: "acme.home.page.home",
      ref: home,
      path: "home",
      modeId: "project",
      projectLanding: true,
      main: { kind: "panels" },
      slots: [],
    });
    setDashboardExtensionsReadyProject(workbench, "project-1");
    await flushMicrotasks();
    expect(workbench.pages.store.getState().location?.page).toEqual(home);
    expect(workbench.layout.getPlaceholder("main")).toBeUndefined();
    bootstrap.dispose();
  });

test("delayed boot preserves the active project recovery overlay", () => {
  const workbench = createWorkbench({ resolvePagePersistenceScope: resolveDashboardPersistenceScope });
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  selectDashboardProject(workbench, { id: "project-1", name: "Project" });
  workbench.pages.registerPage({
    id: "tools",
    ref: { kind: "page", extensionId: "pstdio", id: "tools" },
    path: "tools",
    modeId: "project",
    main: { kind: "panels" },
    slots: [],
  });
  workbench.views.registerView({
    id: "opening",
    title: "Opening project",
    body: { kind: "react", render: () => null },
  });
  workbench.overlays.registerOverlay({ id: "opening", viewId: "opening", closable: false });
  const bootstrap = workbench.registerModule(createBootstrapModule());
  const opening = workbench.overlays.openOverlay("opening");
  setDashboardExtensionsReadyProject(workbench, "project-1");
  expect(workbench.layout.getLayout().regions.overlay.widgets.some((placement) => placement.widgetId === opening)).toBe(
    true,
  );
  bootstrap.dispose();
});
