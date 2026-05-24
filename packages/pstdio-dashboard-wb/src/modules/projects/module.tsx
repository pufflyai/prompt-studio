import type { WorkbenchModuleContribution, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { workbenchCommandPaletteMenuPath } from "pstdio-workbench/core";
import { dashboardCommandIds } from "../../shared/commands";
import { subscribeDashboardData } from "../../shared/data/dashboard-rows";
import { registerLeftHeaderContribution } from "../../shared/header-contributions";
import { getDashboardSelectedProjectId, selectDashboardProject } from "../../shared/project-context";
import type { DashboardProjectSelectionPersistence } from "../../shared/project-selection-persistence";
import { dashboardResources } from "../../shared/resources";
import { dashboardWidgetIds } from "../../shared/widget-ids";
import { CreateProjectWidget } from "./components/create-project-widget";
import { ProjectLeftHeader } from "./components/project-left-header";
import { ProjectPickerWidget } from "./components/project-picker-widget";
import { createDashboardProjects, findDashboardProject } from "./data/project-data";

interface CreateProjectsModuleInput {
  projectSelectionPersistence?: DashboardProjectSelectionPersistence;
}

const projectSelectionContentAreas = [
  "left",
  "main-left",
  "main",
  "main-right",
  "main-bottom",
  "floating-header",
  "floating",
  "overlay",
] as const;

const projectSelectionOverlayWidgetIds = new Set<string>([
  dashboardWidgetIds.projectPicker,
  dashboardWidgetIds.createProject,
]);

const persistentDashboardChromeWidgetIds = new Set<string>([dashboardWidgetIds.header, dashboardWidgetIds.leftHeader]);

const closeProjectSelectionOverlays = (ctx: WorkbenchModuleContributionContext) => {
  const overlayWidgets = ctx.layout.getLayout().areas.overlay.widgets;

  for (const placement of overlayWidgets) {
    if (projectSelectionOverlayWidgetIds.has(placement.contributionId)) {
      ctx.layout.removeWidgetPlacement(placement.widgetId);
    }
  }
};

const clearProjectScopedPlacements = (ctx: WorkbenchModuleContributionContext) => {
  const placements = Object.values(ctx.layout.getLayout().areas).flatMap((area) => area.widgets);

  for (const placement of placements) {
    if (persistentDashboardChromeWidgetIds.has(placement.contributionId)) continue;
    ctx.layout.removeWidgetPlacement(placement.widgetId);
  }
};

const resetProjectModeOnProjectChange = (
  ctx: WorkbenchModuleContributionContext,
  previousProjectId: string | undefined,
  nextProjectId: string,
) => {
  if (previousProjectId === nextProjectId) return;

  ctx.modes.setActiveMode(undefined);
  clearProjectScopedPlacements(ctx);
};

const selectPersistedProject = (
  ctx: WorkbenchModuleContributionContext,
  persistence: DashboardProjectSelectionPersistence | undefined,
) => {
  const projectId = persistence?.getSelectedProjectId();
  if (!projectId || getDashboardSelectedProjectId(ctx)) return undefined;

  const project = findDashboardProject(projectId);
  if (!project) return undefined;

  selectDashboardProject({ context: ctx.context.createScope("dashboard.selectedProject") }, project, persistence);
  return project;
};

const registerPersistedProjectSelection = (
  ctx: WorkbenchModuleContributionContext,
  persistence: DashboardProjectSelectionPersistence | undefined,
) => {
  if (!persistence?.getSelectedProjectId()) return undefined;
  if (selectPersistedProject(ctx, persistence)) return undefined;

  const unsubscribeDashboardData = subscribeDashboardData(() => {
    if (getDashboardSelectedProjectId(ctx)) {
      unsubscribeDashboardData();
      return;
    }

    if (selectPersistedProject(ctx, persistence)) unsubscribeDashboardData();
  });

  return { dispose: unsubscribeDashboardData };
};

const registerProjectWidgets = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerWidget({
    id: dashboardWidgetIds.projectPicker,
    title: "Projects",
    area: "overlay",
    singleton: true,
    closable: true,
    rendererId: dashboardWidgetIds.projectPicker,
    config: { size: "lg", placement: "center", scrollBehavior: "inside" },
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.projectPicker,
    render: (input) => <ProjectPickerWidget input={input} />,
  });

  ctx.layout.registerWidget({
    id: dashboardWidgetIds.createProject,
    title: "Create project",
    area: "overlay",
    singleton: true,
    closable: true,
    rendererId: dashboardWidgetIds.createProject,
    config: { size: "lg", placement: "center", scrollBehavior: "inside", closeOnInteractOutside: false },
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.createProject,
    render: (input) => <CreateProjectWidget input={input} />,
  });
};

const registerProjectSelectionMode = (ctx: WorkbenchModuleContributionContext) => {
  ctx.modes.registerMode({
    id: "project-selection",
    label: "Projects",
    activate(modeCtx) {
      for (const area of projectSelectionContentAreas) modeCtx.layout.clearArea(area);
      modeCtx.layout.openWidget(dashboardWidgetIds.projectPicker, { title: "Projects", closable: false });
      return undefined;
    },
  });
};

const registerProjects = (
  ctx: WorkbenchModuleContributionContext,
  persistence: DashboardProjectSelectionPersistence | undefined,
) => {
  const selectedProjectContext = { context: ctx.context.createScope("dashboard.selectedProject") };

  ctx.resources.registerKind({ kind: "project", label: "Project", icon: "FolderGit2" });

  ctx.resources.registerProvider({
    id: "dashboard-workbench.projects",
    kind: "project",
    list: (query) => {
      const normalizedQuery = query.trim().toLowerCase();
      const projects = createDashboardProjects().filter((project) => {
        if (!normalizedQuery) return true;
        return (
          project.name.toLowerCase().includes(normalizedQuery) ||
          (project.repoPath ?? "").toLowerCase().includes(normalizedQuery)
        );
      });

      return projects.map((project) => ({
        resource: project.resource,
        description: project.repoPath ?? undefined,
        group: "Projects",
      }));
    },
  });

  ctx.resources.registerOpener({
    id: "dashboard.projects.opener",
    priority: 1000,
    canOpen: (resource) => resource.kind === "project",
    open: (resource, input) => {
      const project = findDashboardProject(resource.id) ?? {
        id: resource.id ?? resource.uri,
        name: resource.label ?? resource.id ?? resource.uri,
      };
      const previousProjectId = getDashboardSelectedProjectId(ctx);

      selectDashboardProject(selectedProjectContext, project, persistence);
      resetProjectModeOnProjectChange(ctx, previousProjectId, project.id);
      closeProjectSelectionOverlays(ctx);
      if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.workspaceSidebar)) {
        ctx.renderers.refresh(dashboardWidgetIds.workspaceSidebar);
      }
      if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.sessionsSidebar)) {
        ctx.renderers.refresh(dashboardWidgetIds.sessionsSidebar);
      }
      return ctx.resources.openResource(dashboardResources.workspaces, { replaceActive: input.replaceActive });
    },
  });
};

const registerProjectCommands = (ctx: WorkbenchModuleContributionContext) => {
  ctx.commands.registerCommand(
    { id: dashboardCommandIds.openProjects, label: "Projects", category: "Dashboard", icon: "FolderGit2" },
    {
      execute: () => {
        if (!getDashboardSelectedProjectId(ctx)) {
          ctx.modes.setActiveMode("project-selection");
          return undefined;
        }

        return ctx.layout.openWidget(dashboardWidgetIds.projectPicker, { title: "Projects" });
      },
    },
  );
  ctx.commands.registerCommand(
    { id: dashboardCommandIds.createProject, label: "Create project", category: "Dashboard", icon: "Plus" },
    { execute: () => ctx.layout.openWidget(dashboardWidgetIds.createProject, { title: "Create project" }) },
  );
  ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
    commandId: dashboardCommandIds.openProjects,
    order: 5,
  });
  ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
    commandId: dashboardCommandIds.createProject,
    order: 6,
  });
};

export const createProjectsModule = (input: CreateProjectsModuleInput = {}) =>
  ({
    id: "dashboard.projects",
    activate(ctx) {
      registerProjectWidgets(ctx);
      registerProjectSelectionMode(ctx);
      registerProjects(ctx, input.projectSelectionPersistence);
      registerProjectCommands(ctx);
      const persistedProjectSelection = registerPersistedProjectSelection(ctx, input.projectSelectionPersistence);
      registerLeftHeaderContribution(ctx, {
        id: "dashboard.projects.left-header",
        render: (renderInput) => <ProjectLeftHeader input={renderInput} />,
        canRender: () => true,
      });

      return persistedProjectSelection;
    },
  }) satisfies WorkbenchModuleContribution;
