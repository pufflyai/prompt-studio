import { describe, expect, mock, test } from "bun:test";
import { createWorkbench, type WorkbenchPageLocationBrowser } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { setDashboardExtensionsReadyProject } from "@/shared/extensions/extension-readiness";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createBootstrapModule } from "./bootstrap";
import { createExtensionsModule } from "./extensions/module";
import { emptyAppearance, flushMicrotasks, metadata } from "./extensions/module-test-fixtures";
import { createStartModule } from "./start/module";

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
  test("waits for project extensions before choosing the fixed Start page", async () => {
    const workbench = createWorkbench();
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const start = workbench.registerModule(createStartModule());
    const bootstrap = workbench.registerModule(createBootstrapModule());

    try {
      await flushMicrotasks();
      expect(activeViewId(workbench)).toBeUndefined();

      setDashboardExtensionsReadyProject(workbench, "project-1");
      await flushMicrotasks();
      expect(activeViewId(workbench)).toBe(dashboardWidgetIds.start);
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

  test("boots an extension page URL after its public page contribution registers", async () => {
    const workbench = createWorkbench({
      pageLocationBrowser: browserAt("/projects/project-1/extensions/pstdio.extension-lab/lab"),
    });
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
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
      expect(activeViewId(workbench)).toBe("pstdio.extension-lab.view.labPage");
      expect(workbench.pages.store.getState().activePageId).toBe("pstdio.extension-lab.page.labPage");
    } finally {
      bootstrap.dispose();
      extensions.dispose();
      start.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });
});
