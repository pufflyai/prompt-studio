import { describe, expect, mock, test } from "bun:test";
import { createWorkbenchCore, type ResourceRef } from "@pstdio/workbench";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardViews } from "@/shared/app/resources";
import { clearCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createBootstrapModule } from "./bootstrap";
import { createExtensionsModule } from "./extensions/module";
import {
  emptyAppearance,
  flushMicrotasks,
  metadata,
  metadataWithResourceExtension,
} from "./extensions/module-test-fixtures";
import { createStartModule } from "./start/module";

const activeViewId = (workbench: ReturnType<typeof createWorkbenchCore>) => {
  const layout = workbench.layout.getLayout();
  const activeWidgetId = layout.regions.main.activeWidgetId;
  return layout.regions.main.widgets.find((placement) => placement.widgetId === activeWidgetId)?.viewId;
};

describe("createBootstrapModule", () => {
  test("opens the Start view when a selected project has no saved location", async () => {
    const workbench = createWorkbenchCore();
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const start = workbench.registerModule(createStartModule());
    const bootstrap = workbench.registerModule(createBootstrapModule());

    try {
      await flushMicrotasks();
      expect(activeViewId(workbench)).toBe(dashboardViews.start.id);
      expect(workbench.getPrimaryResource()).toBeUndefined();
    } finally {
      bootstrap.dispose();
      start.dispose();
    }
  });

  test("restores a domain resource after extension metadata registers its presenter", async () => {
    const issue = {
      kind: "issue",
      uri: "acme://issue/ISSUE-10",
      id: "ISSUE-10",
      label: "Issue 10",
      metadata: { projectId: "project-1" },
    } satisfies ResourceRef;
    let savedResource: ResourceRef | undefined = issue;
    let resolveMetadata: (value: typeof metadataWithResourceExtension) => void = () => undefined;
    const metadataPromise = new Promise<typeof metadataWithResourceExtension>((resolve) => {
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
      expect(workbench.getPrimaryResource()).toBeUndefined();

      resolveMetadata(metadataWithResourceExtension);
      await flushMicrotasks();

      expect(workbench.getPrimaryResource()?.uri).toBe(issue.uri);
    } finally {
      bootstrap.dispose();
      extensions.dispose();
      start.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });

  test("falls back to Start when a legacy extension view is gone", async () => {
    let savedResource: ResourceRef | undefined = {
      kind: "extension-view",
      uri: "dashboard-workbench://project/project-1/extension-views/deleted-view",
      id: "deleted-view",
      label: "Deleted view",
    };
    const lastResourcePersistence = {
      getLastResource: () => undefined,
      setLastResource: (resource: ResourceRef | undefined) => {
        savedResource = resource;
      },
      getLegacyViewResource: () => savedResource,
      clearLegacyViewResource: () => {
        savedResource = undefined;
      },
    };
    const workbench = createWorkbenchCore({ lastResourcePersistence });

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const start = workbench.registerModule(createStartModule());
    const extensions = workbench.registerModule(
      createExtensionsModule({
        loadAppearance: mock(async () => emptyAppearance),
        loadMetadata: mock(async () => metadata),
      }),
    );
    const bootstrap = workbench.registerModule(createBootstrapModule({ lastResourcePersistence }));

    try {
      await flushMicrotasks();
      await flushMicrotasks();
      expect(activeViewId(workbench)).toBe(dashboardViews.start.id);
      expect(savedResource).toBeUndefined();
    } finally {
      bootstrap.dispose();
      extensions.dispose();
      start.dispose();
      clearCachedDashboardExtensionMetadata("project-1");
    }
  });
});
