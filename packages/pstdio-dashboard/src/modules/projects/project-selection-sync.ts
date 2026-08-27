import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { isInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import type { SelectProjectInput } from "@/shared/app/commands";
import {
  clearDashboardNavigationState,
  registerDashboardNavigator,
  syncDashboardLayoutPersistenceScope,
} from "@/shared/app/navigation-state";
import {
  clearDashboardProjectSelection,
  getDashboardSelectedProjectId,
  selectDashboardProject,
  subscribeDashboardSelectedProject,
} from "@/shared/app/project-context";
import type { DashboardProjectSelectionPersistence } from "@/shared/app/project-selection-persistence";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { createDashboardProjects, findDashboardProject } from "./data/project-data";

export type DashboardProjectSelectionContext = {
  context: Pick<WorkbenchModuleContext["context"], "delete" | "set">;
};

const projectSelectionOverlayWidgetIds = new Set<string>([
  dashboardWidgetIds.projectPicker,
  dashboardWidgetIds.createProject,
]);

export const closeProjectSelectionOverlays = (ctx: WorkbenchModuleContext) => {
  const overlayWidgets = ctx.layout.getLayout().regions.overlay.widgets;

  for (const placement of overlayWidgets) {
    if (projectSelectionOverlayWidgetIds.has(placement.contributionId)) {
      ctx.layout.removeWidgetPlacement(placement.widgetId);
    }
  }
};

export const resetProjectModeOnProjectChange = (
  ctx: WorkbenchModuleContext,
  previousProjectId: string | undefined,
  nextProjectId: string,
) => {
  if (previousProjectId === nextProjectId) return;
  ctx.modes.setActiveMode(undefined);
};

const validateProjectSelection = (input: SelectProjectInput) => {
  const project = input?.project;
  if (!project || typeof project.id !== "string" || project.id.trim().length === 0) {
    throw new Error("Project selection requires a project ID");
  }
  if (typeof project.name !== "string" || project.name.trim().length === 0) {
    throw new Error("Project selection requires a project name");
  }
  return project;
};

export const selectProject = (
  ctx: WorkbenchModuleContext,
  selectedProjectContext: DashboardProjectSelectionContext,
  persistence: DashboardProjectSelectionPersistence | undefined,
  input: SelectProjectInput,
) => {
  const project = validateProjectSelection(input);
  const previousProjectId = getDashboardSelectedProjectId(ctx);

  closeProjectSelectionOverlays(ctx);
  if (previousProjectId === project.id) return;

  resetProjectModeOnProjectChange(ctx, previousProjectId, project.id);
  selectDashboardProject(selectedProjectContext, project, persistence);
  if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidenav)) {
    ctx.renderers.refresh(dashboardWidgetIds.dashboardSidenav);
  }
};

export const registerProjectWorkbenchScope = (ctx: WorkbenchModuleContext) => {
  let currentProjectId = getDashboardSelectedProjectId(ctx);

  // Mode-driven scope rotation is owned by the atomic navigator; this sync covers
  // project selection changes only, so there is no second navigation path.
  registerDashboardNavigator(ctx);

  const syncScope = () => {
    const projectId = getDashboardSelectedProjectId(ctx);
    if (projectId !== currentProjectId) {
      clearDashboardNavigationState(ctx);
      currentProjectId = projectId;
    }
    ctx.history.setPersistenceScope(projectId ? `project:${projectId}` : undefined);
    syncDashboardLayoutPersistenceScope(ctx);
  };

  syncScope();
  const unsubscribeProject = subscribeDashboardSelectedProject(ctx, syncScope);
  return {
    dispose: () => {
      unsubscribeProject();
    },
  };
};

export const clearSelectedProject = (
  ctx: WorkbenchModuleContext,
  selectedProjectContext: DashboardProjectSelectionContext,
  persistence: DashboardProjectSelectionPersistence | undefined,
) => {
  clearDashboardProjectSelection(selectedProjectContext, persistence);
  ctx.modes.setActiveMode("project-selection");
  // Drop project-scoped history after the mode switch so it cannot replay a guarded project view.
  ctx.history.clear();
};

const selectPersistedProject = (
  ctx: WorkbenchModuleContext,
  selectedProjectContext: DashboardProjectSelectionContext,
  persistence: DashboardProjectSelectionPersistence | undefined,
) => {
  const projectId = persistence?.getSelectedProjectId();
  if (!projectId || getDashboardSelectedProjectId(ctx)) return undefined;

  const project = findDashboardProject(projectId);
  if (!project) return undefined;

  selectProject(ctx, selectedProjectContext, persistence, { project });
  return project;
};

export const registerPersistedProjectSelection = (
  ctx: WorkbenchModuleContext,
  selectedProjectContext: DashboardProjectSelectionContext,
  persistence: DashboardProjectSelectionPersistence | undefined,
) => {
  if (!persistence?.getSelectedProjectId()) return undefined;
  if (selectPersistedProject(ctx, selectedProjectContext, persistence)) return undefined;
  if (isInitialCollectionsSyncComplete()) {
    persistence.setSelectedProjectId(undefined);
    return undefined;
  }

  const unsubscribeDashboardData = subscribeDashboardData(() => {
    if (getDashboardSelectedProjectId(ctx)) {
      unsubscribeDashboardData();
      return;
    }

    if (selectPersistedProject(ctx, selectedProjectContext, persistence)) {
      unsubscribeDashboardData();
      return;
    }

    if (isInitialCollectionsSyncComplete()) {
      persistence.setSelectedProjectId(undefined);
      unsubscribeDashboardData();
    }
  });

  return { dispose: unsubscribeDashboardData };
};

export const registerSelectedProjectDeletionSync = (
  ctx: WorkbenchModuleContext,
  selectedProjectContext: DashboardProjectSelectionContext,
  persistence: DashboardProjectSelectionPersistence | undefined,
) => {
  const syncSelectedProject = (change?: { table?: string }) => {
    if (change?.table && change.table !== "projects") return;
    if (!isInitialCollectionsSyncComplete()) return;

    const currentProjectId = getDashboardSelectedProjectId(ctx);
    if (!currentProjectId || findDashboardProject(currentProjectId)) return;
    clearSelectedProject(ctx, selectedProjectContext, persistence);
  };

  syncSelectedProject();
  const unsubscribeDashboardData = subscribeDashboardData(syncSelectedProject);
  return { dispose: unsubscribeDashboardData };
};

const selectOnlySyncedProject = (
  ctx: WorkbenchModuleContext,
  selectedProjectContext: DashboardProjectSelectionContext,
  persistence: DashboardProjectSelectionPersistence | undefined,
) => {
  if (getDashboardSelectedProjectId(ctx)) return false;
  if (!isInitialCollectionsSyncComplete()) return false;

  const projects = createDashboardProjects();
  if (projects.length !== 1) return false;

  selectProject(ctx, selectedProjectContext, persistence, { project: projects[0] });
  return true;
};

export const registerSingleProjectSelectionSync = (
  ctx: WorkbenchModuleContext,
  selectedProjectContext: DashboardProjectSelectionContext,
  persistence: DashboardProjectSelectionPersistence | undefined,
) => {
  selectOnlySyncedProject(ctx, selectedProjectContext, persistence);

  const unsubscribeDashboardData = subscribeDashboardData((change) => {
    if (change?.table && change.table !== "projects") return;
    selectOnlySyncedProject(ctx, selectedProjectContext, persistence);
  });

  return { dispose: unsubscribeDashboardData };
};
