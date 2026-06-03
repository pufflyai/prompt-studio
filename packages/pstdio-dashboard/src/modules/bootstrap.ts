import type { WorkbenchModuleContribution } from "pstdio-workbench/core";
import { isInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import type { DashboardProjectSelectionPersistence } from "@/shared/app/project-selection-persistence";
import { dashboardResources } from "@/shared/app/resources";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";

interface CreateBootstrapModuleInput {
  projectSelectionPersistence?: DashboardProjectSelectionPersistence;
}

const openProjectSelection = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0]) => {
  ctx.modes.setActiveMode("project-selection");
};

const openSelectedProjectLanding = async (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0]) => {
  if (ctx.lastResource.get()) {
    const restored = await ctx.lastResource.restore();
    if (restored) return;
  }

  await ctx.resources.openResource(dashboardResources.workspaces, {});
};

// Boots the dashboard into the last-opened resource (handled by the workbench
// core's `lastResource` controller) and falls back to the workspaces landing
// view when nothing is saved.
export const createBootstrapModule = (input: CreateBootstrapModuleInput = {}) =>
  ({
    id: "dashboard.bootstrap",
    activate(ctx) {
      ctx.context.set("project.open", true);

      const persistedProjectId = input.projectSelectionPersistence?.getSelectedProjectId();

      if (getDashboardSelectedProjectId(ctx)) {
        void openSelectedProjectLanding(ctx);
        return;
      }

      if (!persistedProjectId) {
        openProjectSelection(ctx);
        return;
      }

      if (isInitialCollectionsSyncComplete()) {
        openProjectSelection(ctx);
        return;
      }

      const unsubscribeDashboardData = subscribeDashboardData(() => {
        if (!isInitialCollectionsSyncComplete()) return;
        unsubscribeDashboardData();

        if (!getDashboardSelectedProjectId(ctx)) {
          openProjectSelection(ctx);
          return;
        }

        void openSelectedProjectLanding(ctx);
      });

      return { dispose: unsubscribeDashboardData };
    },
  }) satisfies WorkbenchModuleContribution;
