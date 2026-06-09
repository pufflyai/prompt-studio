import type { ResourceRef, WorkbenchModuleContribution } from "pstdio-workbench/core";
import { isInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import type { DashboardProjectSelectionPersistence } from "@/shared/app/project-selection-persistence";
import { dashboardResources } from "@/shared/app/resources";
import {
  getDashboardExtensionsReadyProjectId,
  subscribeDashboardExtensionsReadyProject,
} from "@/shared/extensions/extension-readiness";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";

interface CreateBootstrapModuleInput {
  projectSelectionPersistence?: DashboardProjectSelectionPersistence;
}

const openProjectSelection = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0]) => {
  ctx.modes.setActiveMode("project-selection");
};

const canOpenResource = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0], resource: ResourceRef) =>
  Boolean(ctx.resources.getKind(resource.kind)) &&
  ctx.resources.listOpeners().some((opener) => opener.canOpen(resource));

const isExtensionsReadyForSelectedProject = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0]) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  return Boolean(projectId && getDashboardExtensionsReadyProjectId(ctx) === projectId);
};

const openSelectedProjectLanding = async (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0]) => {
  const lastResource = ctx.lastResource.get();

  if (lastResource) {
    if (!canOpenResource(ctx, lastResource) && !isExtensionsReadyForSelectedProject(ctx)) return false;

    const restored = await ctx.lastResource.restore();
    if (restored) return true;
  }

  await ctx.resources.openResource(dashboardResources.start, {});
  return true;
};

const openSelectedProjectLandingWhenReady = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0]) => {
  let unsubscribe: (() => void) | undefined;
  const open = () => {
    void openSelectedProjectLanding(ctx).then((opened) => {
      if (!opened) return;
      unsubscribe?.();
      unsubscribe = undefined;
    });
  };

  open();
  const lastResource = ctx.lastResource.get();
  if (!lastResource || canOpenResource(ctx, lastResource) || isExtensionsReadyForSelectedProject(ctx)) {
    return undefined;
  }

  unsubscribe = subscribeDashboardExtensionsReadyProject(ctx, open);
  return { dispose: () => unsubscribe?.() };
};

// Boots the dashboard into the last-opened resource (handled by the workbench
// core's `lastResource` controller) and falls back to the project start
// view when nothing is saved.
export const createBootstrapModule = (input: CreateBootstrapModuleInput = {}) =>
  ({
    id: "dashboard.bootstrap",
    activate(ctx) {
      ctx.context.set("project.open", true);

      const persistedProjectId = input.projectSelectionPersistence?.getSelectedProjectId();

      if (getDashboardSelectedProjectId(ctx)) {
        return openSelectedProjectLandingWhenReady(ctx);
      }

      if (!persistedProjectId) {
        openProjectSelection(ctx);
        return;
      }

      if (isInitialCollectionsSyncComplete()) {
        openProjectSelection(ctx);
        return;
      }

      let landingDisposable: { dispose(): void } | undefined;
      const unsubscribeDashboardData = subscribeDashboardData(() => {
        if (!isInitialCollectionsSyncComplete()) return;
        unsubscribeDashboardData();

        if (!getDashboardSelectedProjectId(ctx)) {
          openProjectSelection(ctx);
          return;
        }

        landingDisposable = openSelectedProjectLandingWhenReady(ctx);
      });

      return {
        dispose() {
          unsubscribeDashboardData();
          landingDisposable?.dispose();
        },
      };
    },
  }) satisfies WorkbenchModuleContribution;
