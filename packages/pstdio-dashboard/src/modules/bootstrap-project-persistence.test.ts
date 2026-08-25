import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, type LastResourcePersistenceAdapter, type ResourceRef } from "@pstdio/workbench";
import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import {
  createDashboardLastResourcePersistence,
  dashboardLastResourceStorageKey,
} from "@/shared/app/last-resource-persistence";
import { selectDashboardProject } from "@/shared/app/project-context";
import { dashboardViews } from "@/shared/app/resources";
import { createBootstrapModule } from "./bootstrap";
import { flushMicrotasks } from "./extensions/module-test-fixtures";
import { createStartModule } from "./start/module";
import { createWorkspacesModule } from "./workspaces/module";

const createStorage = (): WorkbenchStorageLike => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

const activeViewId = (workbench: ReturnType<typeof createWorkbenchCore>) => {
  const region = workbench.layout.getLayout().regions.main;
  return region.widgets.find((placement) => placement.widgetId === region.activeWidgetId)?.viewId;
};

describe("createBootstrapModule project persistence", () => {
  test("restores and clears a project-scoped legacy dashboard view", async () => {
    const storage = createStorage();
    const projectSelection = { getSelectedProjectId: () => "project-a" };
    const persistence = createDashboardLastResourcePersistence({ namespace: "test", storage, projectSelection });
    storage.setItem(
      dashboardLastResourceStorageKey("test", "project-a"),
      JSON.stringify({
        kind: "dashboard-view",
        uri: "dashboard-workbench://dashboard-view/workspaces",
        id: dashboardViews.workspaces.id,
        label: dashboardViews.workspaces.label,
      }),
    );
    const workbench = createWorkbenchCore({ lastResourcePersistence: persistence });
    selectDashboardProject(workbench, { id: "project-a", name: "Project A" });
    const workspaces = workbench.registerModule(createWorkspacesModule());
    const start = workbench.registerModule(createStartModule());
    const bootstrap = workbench.registerModule(createBootstrapModule({ lastResourcePersistence: persistence }));

    try {
      await flushMicrotasks();
      expect(activeViewId(workbench)).toBe(dashboardViews.workspaces.id);
      expect(storage.getItem(dashboardLastResourceStorageKey("test", "project-a"))).toBeNull();
    } finally {
      bootstrap.dispose();
      start.dispose();
      workspaces.dispose();
    }
  });

  test("replaces a stale project restore with the new project's Start view", async () => {
    const workspace = {
      kind: "workspace",
      uri: "dashboard-workbench://workspace/project-a-workspace",
      id: "project-a-workspace",
      label: "Project A workspace",
      metadata: { projectId: "project-a" },
    } satisfies ResourceRef;
    const savedByProject = new Map<string, ResourceRef | undefined>([["project-a", workspace]]);
    let currentProjectId = "project-a";
    let releaseOpen: (() => void) | undefined;
    const persistence: LastResourcePersistenceAdapter = {
      getLastResource: () => savedByProject.get(currentProjectId),
      setLastResource: (resource) => savedByProject.set(currentProjectId, resource),
    };
    const workbench = createWorkbenchCore({ lastResourcePersistence: persistence });
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.resources.registerKind({ kind: "workspace", label: "Workspace" });
    workbench.layout.registerPanel({ id: "test.workspace", title: "Workspace", region: "main", rendererId: "test" });
    workbench.resources.registerPresenter({
      id: "test.workspace",
      canOpen: (resource) => resource.kind === "workspace",
      open: async (resource) => {
        await new Promise<void>((resolve) => {
          releaseOpen = resolve;
        });
        return workbench.layout.openPanel("test.workspace", { resource });
      },
    });
    selectDashboardProject(workbench, { id: "project-a", name: "Project A" });
    const start = workbench.registerModule(createStartModule());
    const bootstrap = workbench.registerModule(createBootstrapModule());

    try {
      await flushMicrotasks();
      currentProjectId = "project-b";
      selectDashboardProject(workbench, { id: "project-b", name: "Project B" });
      await flushMicrotasks();
      expect(activeViewId(workbench)).toBe(dashboardViews.start.id);

      releaseOpen?.();
      await flushMicrotasks();
      await flushMicrotasks();
      expect(activeViewId(workbench)).toBe(dashboardViews.start.id);
    } finally {
      bootstrap.dispose();
      start.dispose();
    }
  });
});
