import {
  standardResourceIcons,
  type WorkbenchModuleContext,
  type WorkbenchModuleContribution,
  workbenchCommandPaletteMenuPath,
} from "@pstdio/workbench";
import { dashboardCommandIds, type SelectProjectInput } from "@/shared/app/commands";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import type { DashboardProjectSelectionPersistence } from "@/shared/app/project-selection-persistence";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { CreateProjectWidget } from "./components/create-project-widget";
import { ProjectPickerWidget } from "./components/project-picker-widget";
import { createDashboardProjects } from "./data/project-data";
import {
  clearSelectedProject,
  type DashboardProjectSelectionContext,
  registerPersistedProjectSelection,
  registerSelectedProjectDeletionSync,
  registerSingleProjectSelectionSync,
  selectProject,
} from "./project-selection-sync";

interface CreateProjectsModuleInput {
  projectSelectionPersistence?: DashboardProjectSelectionPersistence;
}

const requiredProjectPickerOverlay = "dashboard-workbench.required-project-picker";

const registerProjectWidgets = (ctx: WorkbenchModuleContext) => {
  ctx.views.registerView({
    id: dashboardWidgetIds.projectPicker,
    title: "Projects",
    body: {
      kind: "react",
      render: (input) => <ProjectPickerWidget input={input} />,
    },
  });
  const projectPickerConfig = {
    size: "lg",
    placement: "center",
    scrollBehavior: "inside",
    closeOnInteractOutside: false,
    // Center the close trigger within the 3rem search header instead of the default top offset.
    closeTriggerTop: "3.5",
  };
  ctx.overlays.registerOverlay({
    id: dashboardWidgetIds.projectPicker,
    viewId: dashboardWidgetIds.projectPicker,
    config: projectPickerConfig,
  });
  ctx.overlays.registerOverlay({
    id: requiredProjectPickerOverlay,
    viewId: dashboardWidgetIds.projectPicker,
    closable: false,
    config: projectPickerConfig,
  });

  ctx.views.registerView({
    id: dashboardWidgetIds.createProject,
    title: "Create project",
    body: {
      kind: "react",
      render: (input) => <CreateProjectWidget input={input} />,
    },
  });
  ctx.overlays.registerOverlay({
    id: dashboardWidgetIds.createProject,
    viewId: dashboardWidgetIds.createProject,
    config: { size: "lg", placement: "center", scrollBehavior: "inside", closeOnInteractOutside: false },
  });
};

const registerProjectSelectionMode = (ctx: WorkbenchModuleContext) => {
  ctx.modes.registerMode({
    id: "project-selection",
    label: "Projects",
    chrome: { sidenav: false },
    panels: [],
    activate: () => undefined,
    enter: (modeCtx) => {
      const instanceId = modeCtx.overlays.openOverlay(requiredProjectPickerOverlay, { title: "Projects" });
      return { dispose: () => modeCtx.overlays.closeOverlay(instanceId) };
    },
  });
};

const registerProjects = (ctx: WorkbenchModuleContext) => {
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
        activate: () =>
          ctx.commands.executeCommand(dashboardCommandIds.selectProject, {
            project: { id: project.id, name: project.name },
          } satisfies SelectProjectInput),
      }));
    },
  });
};

const registerProjectCommands = (
  ctx: WorkbenchModuleContext,
  selectedProjectContext: DashboardProjectSelectionContext,
  persistence: DashboardProjectSelectionPersistence | undefined,
) => {
  ctx.commands.registerCommand<SelectProjectInput, void>(
    {
      id: dashboardCommandIds.selectProject,
      label: "Select project",
      category: "Dashboard",
      icon: standardResourceIcons.project,
    },
    { execute: (selection) => selectProject(ctx, selectedProjectContext, persistence, selection) },
  );
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
          ctx.pageLocations.clearProject();
          ctx.modes.setActiveMode("project-selection");
          return undefined;
        }

        return ctx.overlays.openOverlay(dashboardWidgetIds.projectPicker, { title: "Projects" });
      },
    },
  );
  ctx.commands.registerCommand(
    { id: dashboardCommandIds.createProject, label: "Create project", category: "Dashboard", icon: "Plus" },
    {
      execute: () => ctx.overlays.openOverlay(dashboardWidgetIds.createProject, { title: "Create project" }),
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
      const startedWithPersistedProject = Boolean(input.projectSelectionPersistence?.getSelectedProjectId());

      registerProjectWidgets(ctx);
      registerProjectSelectionMode(ctx);
      registerProjects(ctx);
      registerProjectCommands(ctx, selectedProjectContext, input.projectSelectionPersistence);
      const persistedProjectSelection = registerPersistedProjectSelection(
        ctx,
        selectedProjectContext,
        input.projectSelectionPersistence,
      );
      const singleProjectSelection = startedWithPersistedProject
        ? undefined
        : registerSingleProjectSelectionSync(ctx, selectedProjectContext, input.projectSelectionPersistence);
      const selectedProjectDeletionSync = registerSelectedProjectDeletionSync(
        ctx,
        selectedProjectContext,
        input.projectSelectionPersistence,
      );

      return [
        ...(persistedProjectSelection ? [persistedProjectSelection] : []),
        ...(singleProjectSelection ? [singleProjectSelection] : []),
        selectedProjectDeletionSync,
      ];
    },
  }) satisfies WorkbenchModuleContribution;
