import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, type WorkbenchPersistenceAdapter, type WorkbenchSnapshot } from "@pstdio/workbench";
import { getWriter, markInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { selectDashboardNavigationResource } from "@/shared/app/navigation-state";
import { getDashboardSelectedProjectId, selectDashboardProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { createProjectsModule } from "./module";

const findProjectPicker = (workbench: ReturnType<typeof createWorkbenchCore>) =>
  workbench.layout
    .getLayout()
    .regions.overlay.widgets.find((placement) => placement.contributionId === dashboardWidgetIds.projectPicker);

describe("createProjectsModule", () => {
  test("opens a closable project picker without changing the active project mode", async () => {
    const workbench = createWorkbenchCore();
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

  test("selects a project without opening the picker when the main region is empty", async () => {
    const workbench = createWorkbenchCore();
    workbench.registerModule(createProjectsModule());

    await workbench.commands.executeCommand(dashboardCommandIds.selectProject, {
      project: { id: "project-1", name: "Prompt Studio" },
    });

    expect(getDashboardSelectedProjectId(workbench)).toBe("project-1");
    expect(workbench.layout.getActivePanel("main")).toBeUndefined();
    expect(findProjectPicker(workbench)).toBeUndefined();
    expect(workbench.getPrimaryResource()).toBeUndefined();
    expect(workbench.host.getPersistenceScope()).toBe("project/project-1/mode/none/aggregate/empty");
    expect(workbench.history.getPersistenceScope()).toBe("project:project-1");
  });

  test("does not persist the project picker into the project being left", async () => {
    const snapshots = new Map<string | undefined, WorkbenchSnapshot>();
    const workbench = createWorkbenchCore({
      persistence: {
        getSnapshot: (scope) => snapshots.get(scope),
        setSnapshot: (snapshot, scope) => snapshots.set(scope, structuredClone(snapshot)),
      },
    });
    workbench.registerModule(createProjectsModule());
    workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
    const selectProject = (id: string) =>
      workbench.commands.executeCommand(dashboardCommandIds.selectProject, { project: { id, name: id } });
    const sessions = {
      kind: "dashboard-view",
      uri: "dashboard-workbench://sessions",
      id: "sessions",
      label: "Sessions",
    };

    await selectProject("project-a");
    selectDashboardNavigationResource(workbench, sessions, { modeId: "project" });
    await workbench.commands.executeCommand(dashboardCommandIds.openProjects);
    await selectProject("project-b");
    selectDashboardNavigationResource(workbench, sessions, { modeId: "project" });
    await workbench.commands.executeCommand(dashboardCommandIds.openProjects);
    await selectProject("project-a");
    selectDashboardNavigationResource(workbench, sessions, { modeId: "project" });

    expect(
      workbench.layout
        .getLayout()
        .regions.overlay.widgets.some((placement) => placement.contributionId === dashboardWidgetIds.projectPicker),
    ).toBe(false);
  });

  test("clears the back-stack when the selected project is cleared", async () => {
    const workbench = createWorkbenchCore();
    workbench.registerModule(createProjectsModule());
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });

    workbench.layout.registerPanel({
      id: "scratch",
      title: "Scratch",
      region: "main",
      singleton: false,
      reuse: "none",
      rendererId: "noop",
    });
    workbench.resources.registerKind({ kind: "scratch", label: "Scratch" });
    workbench.resources.registerPresenter({
      id: "scratch",
      canOpen: (resource) => resource.kind === "scratch",
      open: (resource) => workbench.layout.openPanel("scratch", { resource }),
    });
    await workbench.resources.openResource({ kind: "scratch", uri: "pstdio://scratch" });
    expect(workbench.history.store.getState().entries.length).toBeGreaterThan(0);

    await workbench.commands.executeCommand(dashboardCommandIds.clearSelectedProject);

    // Project-scoped history must not survive deselection — otherwise Back would replay entries
    // the route project guard cannot render, stranding the cursor.
    expect(workbench.history.store.getState().entries).toEqual([]);
    expect(workbench.history.store.getState().cursor).toBe(-1);
  });
});

describe("createProjectsModule selection restoration", () => {
  test("clears a persisted project that is missing after initial sync", () => {
    const workbench = createWorkbenchCore();
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
    const workbench = createWorkbenchCore();
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
    const workbench = createWorkbenchCore();
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
    const workbench = createWorkbenchCore();
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

  test("keeps restored project Sub Panels when leaving project selection", () => {
    const snapshots = new Map<string | undefined, WorkbenchSnapshot>();
    const persistence = {
      getSnapshot: (scope) => snapshots.get(scope),
      setSnapshot: (snapshot, scope) => snapshots.set(scope, structuredClone(snapshot)),
    } satisfies WorkbenchPersistenceAdapter;
    const seed = createWorkbenchCore({ persistence });
    seed.host.setPersistenceScope("project/project-1/mode/none/aggregate/empty");
    seed.layout.registerPanel({ id: "start", title: "Start", region: "main", rendererId: "noop" });
    seed.layout.registerPanel({
      id: "terminal",
      title: "Terminal",
      region: "secondary",
      rendererId: "noop",
    });
    seed.layout.openPanel("start", {
      resource: { kind: "dashboard-view", uri: "dashboard-workbench://start", id: "start" },
    });
    seed.layout.openPanel("terminal");

    let selectedProjectId: string | undefined;
    const workbench = createWorkbenchCore({ persistence });
    workbench.layout.registerPanel({
      id: "start",
      title: "Start",
      region: "main",
      rendererId: "noop",
    });
    workbench.layout.registerPanel({
      id: "terminal",
      title: "Terminal",
      region: "secondary",
      rendererId: "noop",
    });
    getWriter("projects")?.truncateAndWrite([]);
    const projects = workbench.registerModule(
      createProjectsModule({
        projectSelectionPersistence: {
          getSelectedProjectId: () => selectedProjectId,
          setSelectedProjectId: (projectId) => {
            selectedProjectId = projectId;
          },
        },
      }),
    );

    try {
      workbench.modes.setActiveMode("project-selection");
      getWriter("projects")?.truncateAndWrite([
        { id: "project-1", name: "Prompt Studio", created_at: "2026-01-01T00:00:00.000Z" },
      ]);
      workbench.modes.setActiveMode(undefined);

      expect(workbench.layout.getLayout().regions.secondary.widgets.map((widget) => widget.contributionId)).toEqual([
        "terminal",
      ]);
    } finally {
      projects.dispose();
      getWriter("projects")?.truncateAndWrite([]);
    }
  });
});

describe("project resource search", () => {
  test("activates results through the selection command without a presenter", async () => {
    const workbench = createWorkbenchCore();
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
      expect(workbench.resources.listPresenters().some((presenter) => presenter.canOpen(entry!.resource))).toBe(false);
    } finally {
      projects.dispose();
      getWriter("projects")?.truncateAndWrite([]);
    }
  });
});
