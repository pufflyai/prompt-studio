import {
  standardResourceIcons,
  type WorkbenchModuleContribution,
  type WorkbenchModuleContributionContext,
  workbenchCommandPaletteMenuPath,
} from "pstdio-workbench/core";
import { isInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import {
  clearDashboardProjectSelection,
  getDashboardSelectedProjectId,
  selectDashboardProject,
  subscribeDashboardSelectedProject,
} from "@/shared/app/project-context";
import type { DashboardProjectSelectionPersistence } from "@/shared/app/project-selection-persistence";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { registerLeftHeaderContribution } from "@/shared/workbench/contributions/header-contributions";
import { CreateProjectWidget } from "./components/create-project-widget";
import { ProjectLeftHeader } from "./components/project-left-header";
import { ProjectPickerWidget } from "./components/project-picker-widget";
import { createDashboardProjects, findDashboardProject } from "./data/project-data";

interface CreateProjectsModuleInput {
  projectSelectionPersistence?: DashboardProjectSelectionPersistence;
}

type DashboardProjectSelectionContext = {
  context: Pick<WorkbenchModuleContributionContext["context"], "delete" | "set">;
};

const projectSelectionContentAreas = [
  "left",
  "main-left",
  "main",
  "main-right",
  "secondary",
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

const clearSelectedProject = (
  ctx: WorkbenchModuleContributionContext,
  selectedProjectContext: DashboardProjectSelectionContext,
  persistence: DashboardProjectSelectionPersistence | undefined,
) => {
  clearDashboardProjectSelection(selectedProjectContext, persistence);
  ctx.modes.setActiveMode("project-selection");
  // Drop the project-scoped back-stack last (after the mode switch settles its own placements):
  // with no project selected, replaying those entries would hit the route project guard and
  // strand the history cursor on a view that never renders.
  ctx.history.clear();
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

const registerSelectedProjectDeletionSync = (
  ctx: WorkbenchModuleContributionContext,
  selectedProjectContext: DashboardProjectSelectionContext,
  persistence: DashboardProjectSelectionPersistence | undefined,
) => {
  let selectedProjectWasSynced = Boolean(
    getDashboardSelectedProjectId(ctx) && findDashboardProject(getDashboardSelectedProjectId(ctx)),
  );

  const refreshSelectedProjectTracking = () => {
    const currentProjectId = getDashboardSelectedProjectId(ctx);
    selectedProjectWasSynced = Boolean(currentProjectId && findDashboardProject(currentProjectId));
  };

  const unsubscribeSelectedProject = subscribeDashboardSelectedProject(ctx, refreshSelectedProjectTracking);
  const unsubscribeDashboardData = subscribeDashboardData((change) => {
    if (change?.table && change.table !== "projects") return;
    if (!isInitialCollectionsSyncComplete()) return;

    const currentProjectId = getDashboardSelectedProjectId(ctx);
    if (!currentProjectId) {
      refreshSelectedProjectTracking();
      return;
    }

    if (findDashboardProject(currentProjectId)) {
      refreshSelectedProjectTracking();
      return;
    }

    if (!selectedProjectWasSynced) return;
    clearSelectedProject(ctx, selectedProjectContext, persistence);
    selectedProjectWasSynced = false;
  });

  return {
    dispose() {
      unsubscribeSelectedProject();
      unsubscribeDashboardData();
    },
  };
};

const registerProjectWidgets = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerWidget({
    id: dashboardWidgetIds.projectPicker,
    title: "Projects",
    area: "overlay",
    singleton: true,
    closable: true,
    rendererId: dashboardWidgetIds.projectPicker,
    // Center the close trigger within the 3rem search header instead of the default top offset.
    config: { size: "lg", placement: "center", scrollBehavior: "inside", closeTriggerTop: "3.5" },
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

  ctx.resources.registerOpener({
    id: "dashboard.projects.opener",
    priority: 1000,
    canOpen: (resource) => resource.kind === "project",
    open: (resource) => {
      const project = findDashboardProject(resource.id) ?? {
        id: resource.id ?? resource.uri,
        name: resource.label ?? resource.id ?? resource.uri,
      };
      const previousProjectId = getDashboardSelectedProjectId(ctx);

      resetProjectModeOnProjectChange(ctx, previousProjectId, project.id);
      selectDashboardProject(selectedProjectContext, project, persistence);
      closeProjectSelectionOverlays(ctx);
      if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidebar)) {
        ctx.renderers.refresh(dashboardWidgetIds.dashboardSidebar);
      }
      // The bootstrap module subscribes to selection changes and runs the
      // landing flow (restore the project's last view or fall back to start),
      // so selecting a different project leaves the per-project decision to
      // bootstrap. Re-selecting the same project stays on the current view.
      return undefined;
    },
  });
};

const registerProjectCommands = (
  ctx: WorkbenchModuleContributionContext,
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
      const selectedProjectContext = { context: ctx.context.createScope("dashboard.selectedProject") };

      registerProjectWidgets(ctx);
      registerProjectSelectionMode(ctx);
      registerProjects(ctx, selectedProjectContext, input.projectSelectionPersistence);
      registerProjectCommands(ctx, selectedProjectContext, input.projectSelectionPersistence);
      const persistedProjectSelection = registerPersistedProjectSelection(ctx, input.projectSelectionPersistence);
      const selectedProjectDeletionSync = registerSelectedProjectDeletionSync(
        ctx,
        selectedProjectContext,
        input.projectSelectionPersistence,
      );
      registerLeftHeaderContribution(ctx, {
        id: "dashboard.projects.left-header",
        render: (renderInput) => <ProjectLeftHeader input={renderInput} />,
        canRender: () => true,
      });

      return [...(persistedProjectSelection ? [persistedProjectSelection] : []), selectedProjectDeletionSync];
    },
  }) satisfies WorkbenchModuleContribution;
