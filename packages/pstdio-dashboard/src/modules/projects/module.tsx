import {
  standardResourceIcons,
  type WorkbenchModuleContext,
  type WorkbenchModuleContribution,
  workbenchCommandPaletteMenuPath,
} from "@pstdio/workbench";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId, selectDashboardProject } from "@/shared/app/project-context";
import type { DashboardProjectSelectionPersistence } from "@/shared/app/project-selection-persistence";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { CreateProjectWidget } from "./components/create-project-widget";
import { ProjectPickerWidget } from "./components/project-picker-widget";
import { createDashboardProjects, findDashboardProject } from "./data/project-data";
import {
  clearSelectedProject,
  closeProjectSelectionOverlays,
  type DashboardProjectSelectionContext,
  registerPersistedProjectSelection,
  registerProjectWorkbenchScope,
  registerSelectedProjectDeletionSync,
  registerSingleProjectSelectionSync,
  resetProjectModeOnProjectChange,
} from "./project-selection-sync";

interface CreateProjectsModuleInput {
  projectSelectionPersistence?: DashboardProjectSelectionPersistence;
}

const projectSelectionContentRegions = [
  "sidenav",
  "main-left-menu",
  "main",
  "main-right-menu",
  "secondary",
  "side-header",
  "side",
  "overlay",
] as const;

const registerProjectWidgets = (ctx: WorkbenchModuleContext) => {
  ctx.layout.registerPanel({
    id: dashboardWidgetIds.projectPicker,
    title: "Projects",
    region: "overlay",
    singleton: true,
    rendererId: dashboardWidgetIds.projectPicker,
    // Center the close trigger within the 3rem search header instead of the default top offset.
    config: {
      size: "lg",
      placement: "center",
      scrollBehavior: "inside",
      closeOnInteractOutside: false,
      closeTriggerTop: "3.5",
    },
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.projectPicker,
    render: (input) => <ProjectPickerWidget input={input} />,
  });

  ctx.layout.registerPanel({
    id: dashboardWidgetIds.createProject,
    title: "Create project",
    region: "overlay",
    singleton: true,
    rendererId: dashboardWidgetIds.createProject,
    config: { size: "lg", placement: "center", scrollBehavior: "inside", closeOnInteractOutside: false },
  });
  ctx.renderers.registerRenderer({
    id: dashboardWidgetIds.createProject,
    render: (input) => <CreateProjectWidget input={input} />,
  });
};

const registerProjectSelectionMode = (ctx: WorkbenchModuleContext) => {
  ctx.modes.registerMode({
    id: "project-selection",
    label: "Projects",
    panels: [],
    activate: () => undefined,
    seed(modeCtx) {
      for (const region of projectSelectionContentRegions) modeCtx.layout.clearRegion(region);
      modeCtx.layout.openPanel(dashboardWidgetIds.projectPicker, { title: "Projects", closable: true });
    },
  });
};

const registerProjects = (
  ctx: WorkbenchModuleContext,
  selectedProjectContext: DashboardProjectSelectionContext,
  persistence: DashboardProjectSelectionPersistence | undefined,
) => {
  ctx.resources.registerKind({ kind: "project", label: "Project", icon: standardResourceIcons.project });

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

  ctx.resources.registerPresenter({
    id: "dashboard.projects.presenter",
    priority: 1000,
    canOpen: (resource) => resource.kind === "project",
    open: (resource) => {
      const project = findDashboardProject(resource.id) ?? {
        id: resource.id ?? resource.uri,
        name: resource.label ?? resource.id ?? resource.uri,
      };
      const previousProjectId = getDashboardSelectedProjectId(ctx);

      closeProjectSelectionOverlays(ctx);
      resetProjectModeOnProjectChange(ctx, previousProjectId, project.id);
      selectDashboardProject(selectedProjectContext, project, persistence);
      if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidenav)) {
        ctx.renderers.refresh(dashboardWidgetIds.dashboardSidenav);
      }
      // The bootstrap module subscribes to selection changes and runs the
      // landing flow (restore the project's last view or fall back to start),
      // so selecting a different project leaves the per-project decision to
      // bootstrap. Re-selecting the same project stays on the current view.
      return (
        ctx.layout.getActivePanel("main") ??
        ctx.layout.openPanel(dashboardWidgetIds.projectPicker, { title: "Projects", closable: true })
      );
    },
  });
};

const registerProjectCommands = (
  ctx: WorkbenchModuleContext,
  selectedProjectContext: DashboardProjectSelectionContext,
  persistence: DashboardProjectSelectionPersistence | undefined,
) => {
  ctx.commands.registerCommand(
    {
      id: dashboardCommandIds.clearSelectedProject,
      label: "Clear selected project",
      category: "Dashboard",
      icon: standardResourceIcons.project,
    },
    { execute: () => clearSelectedProject(ctx, selectedProjectContext, persistence) },
  );
  ctx.commands.registerCommand(
    {
      id: dashboardCommandIds.openProjects,
      label: "Projects",
      category: "Dashboard",
      icon: standardResourceIcons.project,
    },
    {
      execute: () => {
        if (!getDashboardSelectedProjectId(ctx)) {
          ctx.navigator.commitContext({ modeId: "project-selection", resource: null });
          return undefined;
        }

        return ctx.layout.openPanel(dashboardWidgetIds.projectPicker, { title: "Projects", closable: true });
      },
    },
  );
  ctx.commands.registerCommand(
    { id: dashboardCommandIds.createProject, label: "Create project", category: "Dashboard", icon: "Plus" },
    {
      execute: () =>
        ctx.layout.openPanel(dashboardWidgetIds.createProject, { title: "Create project", closable: true }),
    },
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
      const selectedProjectContext = { context: ctx.context.createScope("dashboard.selectedProject") };

      registerProjectWidgets(ctx);
      registerProjectSelectionMode(ctx);
      registerProjects(ctx, selectedProjectContext, input.projectSelectionPersistence);
      registerProjectCommands(ctx, selectedProjectContext, input.projectSelectionPersistence);
      const projectWorkbenchScope = registerProjectWorkbenchScope(ctx);
      const persistedProjectSelection = registerPersistedProjectSelection(ctx, input.projectSelectionPersistence);
      const singleProjectSelection = registerSingleProjectSelectionSync(
        ctx,
        selectedProjectContext,
        input.projectSelectionPersistence,
      );
      const selectedProjectDeletionSync = registerSelectedProjectDeletionSync(
        ctx,
        selectedProjectContext,
        input.projectSelectionPersistence,
      );

      return [
        ...(persistedProjectSelection ? [persistedProjectSelection] : []),
        projectWorkbenchScope,
        singleProjectSelection,
        selectedProjectDeletionSync,
      ];
    },
  }) satisfies WorkbenchModuleContribution;
