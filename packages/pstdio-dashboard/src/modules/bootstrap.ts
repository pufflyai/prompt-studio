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
import { createDashboardSessions } from "./sessions/data/dashboard-sessions";
import { createDashboardWorkspaces } from "./workspaces/data/dashboard-workspaces";

interface CreateBootstrapModuleInput {
  projectSelectionPersistence?: DashboardProjectSelectionPersistence;
}

const openProjectSelection = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0]) => {
  ctx.modes.setActiveMode("project-selection");
};

const canOpenResource = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0], resource: ResourceRef) =>
  Boolean(ctx.resources.getKind(resource.kind)) &&
  ctx.resources.listOpeners().some((opener) => opener.canOpen(resource));

const isSyncedRestoreResource = (resource: ResourceRef) => resource.kind === "workspace" || resource.kind === "session";

const isWaitingForSyncedResource = (resource: ResourceRef) =>
  isSyncedRestoreResource(resource) && !isInitialCollectionsSyncComplete();

const resourceId = (resource: ResourceRef) => {
  if (resource.id) return resource.id;
  const [, id] = resource.uri.match(/\/([^/]+)$/) ?? [];
  return id ? decodeURIComponent(id) : undefined;
};

const isMissingSyncedResource = (
  ctx: Parameters<WorkbenchModuleContribution["activate"]>[0],
  resource: ResourceRef,
) => {
  if (!isInitialCollectionsSyncComplete()) return false;

  const projectId = getDashboardSelectedProjectId(ctx);
  const id = resourceId(resource);
  if (!projectId || !id) return false;

  if (resource.kind === "workspace") {
    return !createDashboardWorkspaces(projectId).some((workspace) => workspace.id === id);
  }

  if (resource.kind === "session") {
    return !createDashboardSessions(projectId).some((session) => session.id === id);
  }

  return false;
};

const isExtensionsReadyForSelectedProject = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0]) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  return Boolean(projectId && getDashboardExtensionsReadyProjectId(ctx) === projectId);
};

const openSelectedProjectLanding = async (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0]) => {
  const lastResource = ctx.lastResource.get();

  if (lastResource) {
    if (isWaitingForSyncedResource(lastResource)) return false;

    if (isMissingSyncedResource(ctx, lastResource)) {
      ctx.lastResource.set(undefined);
      await ctx.resources.openResource(dashboardResources.start, {});
      return true;
    }

    if (!canOpenResource(ctx, lastResource) && !isExtensionsReadyForSelectedProject(ctx)) return false;

    const restored = await ctx.lastResource.restore();
    if (restored) return true;
  }

  await ctx.resources.openResource(dashboardResources.start, {});
  return true;
};

const openSelectedProjectLandingWhenReady = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0]) => {
  let unsubscribeDashboardData: (() => void) | undefined;
  let unsubscribeExtensionsReady: (() => void) | undefined;
  const dispose = () => {
    unsubscribeDashboardData?.();
    unsubscribeDashboardData = undefined;
    unsubscribeExtensionsReady?.();
    unsubscribeExtensionsReady = undefined;
  };
  const open = () => {
    void openSelectedProjectLanding(ctx).then((opened) => {
      if (!opened) return;
      dispose();
    });
  };

  open();
  const lastResource = ctx.lastResource.get();
  if (!lastResource) return undefined;

  const shouldWaitForSyncedResource = isWaitingForSyncedResource(lastResource);
  const shouldWaitForExtensions = !canOpenResource(ctx, lastResource) && !isExtensionsReadyForSelectedProject(ctx);

  if (!shouldWaitForSyncedResource && !shouldWaitForExtensions) {
    return undefined;
  }

  if (shouldWaitForSyncedResource) unsubscribeDashboardData = subscribeDashboardData(open);
  if (shouldWaitForExtensions) unsubscribeExtensionsReady = subscribeDashboardExtensionsReadyProject(ctx, open);

  return { dispose };
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
