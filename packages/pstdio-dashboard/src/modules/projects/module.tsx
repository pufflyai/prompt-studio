import {
  standardResourceIcons,
  type WorkbenchModuleContext,
  type WorkbenchModuleContribution,
  workbenchCommandPaletteMenuPath,
  workbenchRegions,
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
  registerProjectWorkbenchScope,
  registerSelectedProjectDeletionSync,
  registerSingleProjectSelectionSync,
  selectProject,
} from "./project-selection-sync";

interface CreateProjectsModuleInput {
  projectSelectionPersistence?: DashboardProjectSelectionPersistence;
}

const projectSelectionOverlayWidgetIds = new Set<string>([
  dashboardWidgetIds.projectPicker,
  dashboardWidgetIds.createProject,
]);

const openRequiredProjectPicker = (layout: WorkbenchModuleContext["layout"]) =>
  layout.openPanel(dashboardWidgetIds.projectPicker, { title: "Projects", closable: false });

const restoreProjectHeader = (layout: WorkbenchModuleContext["layout"]) => {
  if (layout.getPanel(dashboardWidgetIds.projectHeader)) {
    layout.openPanel(dashboardWidgetIds.projectHeader, { pinned: true });
  }
};

const seedProjectSelectionLayout = (layout: WorkbenchModuleContext["layout"]) => {
  for (const region of workbenchRegions) layout.clearRegion(region);
  restoreProjectHeader(layout);
  openRequiredProjectPicker(layout);
};

const reconcileProjectSelectionLayout = (layout: WorkbenchModuleContext["layout"]) => {
  for (const region of workbenchRegions) {
    if (region !== "overlay") layout.clearRegion(region);
  }
  restoreProjectHeader(layout);

  const overlay = layout.getLayout().regions.overlay;
  const activeCreateProject = overlay.widgets.find(
    (placement) =>
      placement.widgetId === overlay.activeWidgetId && placement.contributionId === dashboardWidgetIds.createProject,
  );
  for (const placement of overlay.widgets) {
    if (!projectSelectionOverlayWidgetIds.has(placement.contributionId)) {
      layout.removeWidgetPlacement(placement.widgetId);
    }
  }

  openRequiredProjectPicker(layout);
  if (activeCreateProject) layout.activateWidget(activeCreateProject.widgetId);
};

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
    seed: (modeCtx) => seedProjectSelectionLayout(modeCtx.layout),
    reconcile: (modeCtx) => reconcileProjectSelectionLayout(modeCtx.layout),
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
      const startedWithPersistedProject = Boolean(input.projectSelectionPersistence?.getSelectedProjectId());

      registerProjectWidgets(ctx);
      registerProjectSelectionMode(ctx);
      registerProjects(ctx);
      registerProjectCommands(ctx, selectedProjectContext, input.projectSelectionPersistence);
      const projectWorkbenchScope = registerProjectWorkbenchScope(ctx);
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
        projectWorkbenchScope,
        ...(singleProjectSelection ? [singleProjectSelection] : []),
        selectedProjectDeletionSync,
      ];
    },
  }) satisfies WorkbenchModuleContribution;
