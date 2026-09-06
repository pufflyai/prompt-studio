import { describe, expect, test } from "bun:test";
import { createWorkbench, type WorkbenchSnapshot } from "@pstdio/workbench";
import { getWriter, markInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId, selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createProjectsModule } from "./module";

const findProjectPicker = (workbench: ReturnType<typeof createWorkbench>) =>
  workbench.layout
    .getLayout()
    .regions.overlay.widgets.find((placement) => placement.viewId === dashboardWidgetIds.projectPicker);

describe("createProjectsModule", () => {
  test("opens a closable project picker without changing the active project mode", async () => {
    const workbench = createWorkbench();
    workbench.registerModule(createProjectsModule());
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    workbench.layout.registerPanel({ id: "project.main", title: "Project", region: "main", rendererId: "noop" });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    workbench.modes.setActiveMode("project");
    const projectPanel = workbench.layout.openPanel("project.main");

    await workbench.commands.executeCommand(dashboardCommandIds.openProjects);

    expect(workbench.modes.getActiveModeId()).toBe("project");
    expect(workbench.layout.getLayout().regions.main.activeWidgetId).toBe(projectPanel.instanceId);
    expect(findProjectPicker(workbench)?.closable).toBe(true);
  });

  test("selects a project without opening the picker or assigning a page scope", async () => {
    const workbench = createWorkbench();
    workbench.registerModule(createProjectsModule());

    await workbench.commands.executeCommand(dashboardCommandIds.selectProject, {
      project: { id: "project-1", name: "Prompt Studio" },
    });

    expect(getDashboardSelectedProjectId(workbench)).toBe("project-1");
    expect(workbench.layout.getActivePanel("main")).toBeUndefined();
    expect(findProjectPicker(workbench)).toBeUndefined();
    expect(workbench.getPrimaryResource()).toBeUndefined();
    expect(workbench.host.getPersistenceScope()).toBeUndefined();
  });

  test("does not persist the project picker into the project being left", async () => {
    const snapshots = new Map<string | undefined, WorkbenchSnapshot>();
    const workbench = createWorkbench({
      persistence: {
        getSnapshot: (scope) => snapshots.get(scope),
        setSnapshot: (snapshot, scope) => snapshots.set(scope, structuredClone(snapshot)),
      },
    });
    workbench.registerModule(createProjectsModule());
    const selectProject = (id: string) =>
      workbench.commands.executeCommand(dashboardCommandIds.selectProject, { project: { id, name: id } });

    await selectProject("project-a");
    await workbench.commands.executeCommand(dashboardCommandIds.openProjects);
    await selectProject("project-b");
    await workbench.commands.executeCommand(dashboardCommandIds.openProjects);
    await selectProject("project-a");

    expect(
      workbench.layout
        .getLayout()
        .regions.overlay.widgets.some((placement) => placement.viewId === dashboardWidgetIds.projectPicker),
    ).toBe(false);
  });
});

describe("createProjectsModule selection restoration", () => {
  test("clears a persisted project that is missing after initial sync", () => {
    const workbench = createWorkbench();
    let persistedProjectId: string | undefined = "deleted-project";
    getWriter("projects")?.truncateAndWrite([]);

    const projects = workbench.registerModule(
      createProjectsModule({
        projectSelectionPersistence: {
          getSelectedProjectId: () => persistedProjectId,
          setSelectedProjectId: (projectId) => {
            persistedProjectId = projectId;
          },
        },
      }),
    );

    try {
      getWriter("projects")?.truncateAndWrite([
        { id: "current-project", name: "Current project", created_at: "2026-01-01T00:00:00.000Z" },
        { id: "other-project", name: "Other project", created_at: "2026-01-02T00:00:00.000Z" },
      ]);
      markInitialCollectionsSyncComplete();

      expect(getDashboardSelectedProjectId(workbench)).toBeUndefined();
      expect(persistedProjectId).toBeUndefined();
    } finally {
      projects.dispose();
      getWriter("projects")?.truncateAndWrite([]);
    }
  });

  test("does not replace a missing persisted project with the only remaining project", () => {
    const workbench = createWorkbench();
    let persistedProjectId: string | undefined = "deleted-project";
    getWriter("projects")?.truncateAndWrite([
      { id: "current-project", name: "Current project", created_at: "2026-01-01T00:00:00.000Z" },
    ]);
    markInitialCollectionsSyncComplete();

    const projects = workbench.registerModule(
      createProjectsModule({
        projectSelectionPersistence: {
          getSelectedProjectId: () => persistedProjectId,
          setSelectedProjectId: (projectId) => {
            persistedProjectId = projectId;
          },
        },
      }),
    );

    try {
      expect(getDashboardSelectedProjectId(workbench)).toBeUndefined();
      expect(persistedProjectId).toBeUndefined();
    } finally {
      projects.dispose();
      getWriter("projects")?.truncateAndWrite([]);
    }
  });

  test("clears a selected project that is missing after initial sync", () => {
    const workbench = createWorkbench();
    let persistedProjectId: string | undefined = "deleted-project";
    selectDashboardProject(
      { context: workbench.context.createScope("dashboard.selectedProject") },
      { id: "deleted-project", name: "Deleted project" },
    );
    getWriter("projects")?.truncateAndWrite([
      { id: "current-project", name: "Current project", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "other-project", name: "Other project", created_at: "2026-01-02T00:00:00.000Z" },
    ]);

    const projects = workbench.registerModule(
      createProjectsModule({
        projectSelectionPersistence: {
          getSelectedProjectId: () => persistedProjectId,
          setSelectedProjectId: (projectId) => {
            persistedProjectId = projectId;
          },
        },
      }),
    );

    try {
      expect(getDashboardSelectedProjectId(workbench)).toBeUndefined();
      expect(persistedProjectId).toBeUndefined();
      expect(workbench.modes.getActiveModeId()).toBe("project-selection");
    } finally {
      projects.dispose();
      getWriter("projects")?.truncateAndWrite([]);
    }
  });

  test("selects the only synced project when no project is selected", async () => {
    const workbench = createWorkbench();
    getWriter("projects")?.truncateAndWrite([]);

    const projects = workbench.registerModule(createProjectsModule());

    try {
      workbench.modes.setActiveMode("project-selection");
      markInitialCollectionsSyncComplete();
      getWriter("projects")?.truncateAndWrite([
        { id: "project-1", name: "Prompt Studio", created_at: "2026-01-01T00:00:00.000Z" },
      ]);

      expect(getDashboardSelectedProjectId(workbench)).toBe("project-1");
      expect(workbench.modes.getActiveModeId()).toBeUndefined();
    } finally {
      projects.dispose();
      getWriter("projects")?.truncateAndWrite([]);
    }
  });
});

describe("project resource search", () => {
  test("activates results through the selection command without a presenter", async () => {
    const workbench = createWorkbench();
    getWriter("projects")?.truncateAndWrite([
      { id: "project-1", name: "First project", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "project-2", name: "Second project", created_at: "2026-01-02T00:00:00.000Z" },
    ]);
    const projects = workbench.registerModule(createProjectsModule());

    try {
      const provider = workbench.resources
        .listProviders()
        .find((candidate) => candidate.id === "dashboard-workbench.projects");
      const entry = provider?.list("Second", {})[0];

      expect(entry?.activate).toBeFunction();
      await entry?.activate?.(entry.resource);

      expect(getDashboardSelectedProjectId(workbench)).toBe("project-2");
    } finally {
      projects.dispose();
      getWriter("projects")?.truncateAndWrite([]);
    }
  });
});
