import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, type LastResourcePersistenceAdapter, type ResourceRef } from "pstdio-workbench/core";
import type { WorkbenchStorageLike } from "pstdio-workbench/storage";
import { getWriter, markInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import {
  createDashboardLastResourcePersistence,
  dashboardLastResourceStorageKey,
} from "@/shared/app/last-resource-persistence";
import { clearDashboardProjectSelection, selectDashboardProject } from "@/shared/app/project-context";
import { createDashboardProjectSelectionPersistence } from "@/shared/app/project-selection-persistence";
import { dashboardResources } from "@/shared/app/resources";
import { createBootstrapModule } from "./bootstrap";
import { createDashboardViewsModule } from "./dashboard-views/module";
import { flushMicrotasks } from "./extensions/module-test-fixtures";
import { createProjectsModule } from "./projects/module";
import { createStartModule } from "./start/module";
import { createWorkspacesModule } from "./workspaces/module";

const createStorage = (): WorkbenchStorageLike => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
};

const registerDashboardViewOpeners = (workbench: ReturnType<typeof createWorkbenchCore>) => {
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
};

describe("createBootstrapModule project persistence", () => {
  test("re-runs the landing flow with the per-project saved view when the selected project changes", async () => {
    const savedByProject = new Map<string, ResourceRef | undefined>([["project-a", dashboardResources.workspaces]]);
    let currentProjectId: string | undefined = "project-a";
    const lastResourcePersistence: LastResourcePersistenceAdapter = {
      getLastResource: () => (currentProjectId ? savedByProject.get(currentProjectId) : undefined),
      setLastResource: (resource) => {
        if (!currentProjectId) return;
        savedByProject.set(currentProjectId, resource);
      },
    };
    const workbench = createWorkbenchCore({ lastResourcePersistence });

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.modes.registerMode({ id: "project-selection", label: "Projects", activate: () => undefined });
    registerDashboardViewOpeners(workbench);
    selectDashboardProject(workbench, { id: "project-a", name: "Project A" });
    const bootstrap = workbench.registerModule(createBootstrapModule());

    try {
      await flushMicrotasks();
      expect(workbench.getPrimaryResource()?.uri).toBe(dashboardResources.workspaces.uri);

      currentProjectId = "project-b";
      selectDashboardProject(workbench, { id: "project-b", name: "Project B" });
      await flushMicrotasks();

      expect(workbench.getPrimaryResource()?.uri).toBe(dashboardResources.start.uri);
      expect(savedByProject.get("project-b")?.uri).toBe(dashboardResources.start.uri);
      expect(savedByProject.get("project-a")?.uri).toBe(dashboardResources.workspaces.uri);

      currentProjectId = "project-a";
      selectDashboardProject(workbench, { id: "project-a", name: "Project A" });
      await flushMicrotasks();

      expect(workbench.getPrimaryResource()?.uri).toBe(dashboardResources.workspaces.uri);

      currentProjectId = undefined;
      clearDashboardProjectSelection(workbench);
      await flushMicrotasks();

      expect(workbench.modes.getActiveModeId()).toBe("project-selection");
      expect(savedByProject.get("project-a")?.uri).toBe(dashboardResources.workspaces.uri);
    } finally {
      bootstrap.dispose();
    }
  });

  test("ignores a stale async restore when the new project restores the same resource uri", async () => {
    const savedByProject = new Map<string, ResourceRef | undefined>([
      ["project-a", dashboardResources.workspaces],
      ["project-b", dashboardResources.workspaces],
    ]);
    let currentProjectId: string | undefined = "project-a";
    let blockedWorkspaceOpen: (() => void) | undefined;
    const lastResourcePersistence: LastResourcePersistenceAdapter = {
      getLastResource: () => (currentProjectId ? savedByProject.get(currentProjectId) : undefined),
      setLastResource: (resource) => {
        if (!currentProjectId) return;
        savedByProject.set(currentProjectId, resource);
      },
    };
    const workbench = createWorkbenchCore({ lastResourcePersistence });

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    registerDashboardViewOpeners(workbench);
    workbench.resources.registerOpener({
      id: "test.blocked-workspaces",
      priority: 1000,
      canOpen: (candidate) => candidate.uri === dashboardResources.workspaces.uri,
      open: async (candidate) => {
        if (!blockedWorkspaceOpen) {
          await new Promise<void>((resolve) => {
            blockedWorkspaceOpen = resolve;
          });
        }
        return workbench.layout.openWidget("test.workspaces", { resource: candidate });
      },
    });
    selectDashboardProject(workbench, { id: "project-a", name: "Project A" });
    const bootstrap = workbench.registerModule(createBootstrapModule());

    try {
      await flushMicrotasks();

      currentProjectId = "project-b";
      selectDashboardProject(workbench, { id: "project-b", name: "Project B" });
      await flushMicrotasks();

      expect(workbench.getPrimaryResource()?.uri).toBe(dashboardResources.workspaces.uri);
      expect(savedByProject.get("project-b")?.uri).toBe(dashboardResources.workspaces.uri);

      blockedWorkspaceOpen?.();
      await flushMicrotasks();

      expect(workbench.getPrimaryResource()?.uri).toBe(dashboardResources.workspaces.uri);
      expect(savedByProject.get("project-b")?.uri).toBe(dashboardResources.workspaces.uri);
    } finally {
      bootstrap.dispose();
    }
  });

  test("clears a stale async restore when the new project has no saved resource", async () => {
    const savedByProject = new Map<string, ResourceRef | undefined>([["project-a", dashboardResources.workspaces]]);
    let currentProjectId: string | undefined = "project-a";
    let blockedWorkspaceOpen: (() => void) | undefined;
    const lastResourcePersistence: LastResourcePersistenceAdapter = {
      getLastResource: () => (currentProjectId ? savedByProject.get(currentProjectId) : undefined),
      setLastResource: (resource) => {
        if (!currentProjectId) return;
        savedByProject.set(currentProjectId, resource);
      },
    };
    const workbench = createWorkbenchCore({ lastResourcePersistence });

    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    registerDashboardViewOpeners(workbench);
    workbench.resources.registerOpener({
      id: "test.blocked-workspaces",
      priority: 1000,
      canOpen: (candidate) => candidate.uri === dashboardResources.workspaces.uri,
      open: async (candidate) => {
        if (!blockedWorkspaceOpen) {
          await new Promise<void>((resolve) => {
            blockedWorkspaceOpen = resolve;
          });
        }
        return workbench.layout.openWidget("test.workspaces", { resource: candidate });
      },
    });
    selectDashboardProject(workbench, { id: "project-a", name: "Project A" });
    const bootstrap = workbench.registerModule(createBootstrapModule());

    try {
      await flushMicrotasks();

      currentProjectId = "project-b";
      selectDashboardProject(workbench, { id: "project-b", name: "Project B" });
      await flushMicrotasks();

      expect(workbench.getPrimaryResource()?.uri).toBe(dashboardResources.start.uri);
      expect(savedByProject.get("project-b")?.uri).toBe(dashboardResources.start.uri);

      blockedWorkspaceOpen?.();
      await flushMicrotasks();
      await flushMicrotasks();

      expect(workbench.getPrimaryResource()?.uri).toBe(dashboardResources.start.uri);
      expect(savedByProject.get("project-b")?.uri).toBe(dashboardResources.start.uri);
    } finally {
      bootstrap.dispose();
    }
  });

  test("selecting a project through the opener restores that project's landing view", async () => {
    const storage = createStorage();
    const projectSelectionPersistence = createDashboardProjectSelectionPersistence({ namespace: "test", storage });
    projectSelectionPersistence.setSelectedProjectId("project-a");
    storage.setItem(
      dashboardLastResourceStorageKey("test", "project-a"),
      JSON.stringify(dashboardResources.workspaces),
    );
    const workbench = createWorkbenchCore({
      lastResourcePersistence: createDashboardLastResourcePersistence({
        namespace: "test",
        storage,
        projectSelection: projectSelectionPersistence,
      }),
    });

    getWriter("projects")?.truncateAndWrite([
      { id: "project-a", name: "Project A", created_at: "2026-01-02T00:00:00.000Z" },
      { id: "project-b", name: "Project B", created_at: "2026-01-01T00:00:00.000Z" },
    ]);

    const dashboardViews = workbench.registerModule(createDashboardViewsModule());
    const projects = workbench.registerModule(createProjectsModule({ projectSelectionPersistence }));
    const workspaces = workbench.registerModule(createWorkspacesModule());
    const start = workbench.registerModule(createStartModule());
    const bootstrap = workbench.registerModule(createBootstrapModule({ projectSelectionPersistence }));

    try {
      await flushMicrotasks();
      expect(workbench.getPrimaryResource()?.uri).toBe(dashboardResources.workspaces.uri);

      await workbench.resources.openResource({
        kind: "project",
        uri: "dashboard-workbench://project/project-b",
        id: "project-b",
        label: "Project B",
      });
      await flushMicrotasks();

      expect(workbench.getPrimaryResource()?.uri).toBe(dashboardResources.start.uri);
      expect(storage.getItem(dashboardLastResourceStorageKey("test", "project-b"))).toBe(
        JSON.stringify(dashboardResources.start),
      );
    } finally {
      bootstrap.dispose();
      start.dispose();
      workspaces.dispose();
      projects.dispose();
      dashboardViews.dispose();
      getWriter("projects")?.truncateAndWrite([]);
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
