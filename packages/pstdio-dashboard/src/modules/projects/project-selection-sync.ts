import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { isInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import { clearDashboardNavigationState, syncDashboardLayoutPersistenceScope } from "@/shared/app/navigation-state";
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

export const registerProjectWorkbenchScope = (ctx: WorkbenchModuleContext) => {
  let currentProjectId = getDashboardSelectedProjectId(ctx);

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
  const modeSubscription = ctx.modes.onDidChangeActive(() => syncDashboardLayoutPersistenceScope(ctx));
  return {
    dispose: () => {
      unsubscribeProject();
      modeSubscription.dispose();
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
  persistence: DashboardProjectSelectionPersistence | undefined,
) => {
  const projectId = persistence?.getSelectedProjectId();
  if (!projectId || getDashboardSelectedProjectId(ctx)) return undefined;

  const project = findDashboardProject(projectId);
  if (!project) return undefined;

  resetProjectModeOnProjectChange(ctx, getDashboardSelectedProjectId(ctx), project.id);
  selectDashboardProject({ context: ctx.context.createScope("dashboard.selectedProject") }, project, persistence);
  return project;
};

export const registerPersistedProjectSelection = (
  ctx: WorkbenchModuleContext,
  persistence: DashboardProjectSelectionPersistence | undefined,
) => {
  if (!persistence?.getSelectedProjectId()) return undefined;
  if (selectPersistedProject(ctx, persistence)) return undefined;
  if (isInitialCollectionsSyncComplete()) {
    persistence.setSelectedProjectId(undefined);
    return undefined;
  }

  const unsubscribeDashboardData = subscribeDashboardData(() => {
    if (getDashboardSelectedProjectId(ctx)) {
      unsubscribeDashboardData();
      return;
    }

    if (selectPersistedProject(ctx, persistence)) {
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

  resetProjectModeOnProjectChange(ctx, undefined, projects[0].id);
  selectDashboardProject(selectedProjectContext, projects[0], persistence);
  closeProjectSelectionOverlays(ctx);
  if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidenav)) {
    ctx.renderers.refresh(dashboardWidgetIds.dashboardSidenav);
  }
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
