import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { isInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import type { SelectProjectInput } from "@/shared/app/commands";
import {
  clearDashboardProjectSelection,
  getDashboardSelectedProjectId,
  selectDashboardProject,
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
    if (placement.viewId && projectSelectionOverlayWidgetIds.has(placement.viewId)) {
      ctx.overlays.closeOverlay(placement.widgetId);
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
  if (ctx.views.getView(dashboardWidgetIds.dashboardSidenav))
    ctx.views.refreshView(dashboardWidgetIds.dashboardSidenav);
};

export const clearSelectedProject = (
  ctx: WorkbenchModuleContext,
  selectedProjectContext: DashboardProjectSelectionContext,
  persistence: DashboardProjectSelectionPersistence | undefined,
) => {
  clearDashboardProjectSelection(selectedProjectContext, persistence);
  ctx.pageLocations.clearProject();
  ctx.modes.setActiveMode("project-selection");
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
