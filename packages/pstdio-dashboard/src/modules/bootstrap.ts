import type { ResourceRef, WorkbenchModuleContribution } from "@pstdio/workbench/core";
import { isInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import type { DashboardProjectSelectionPersistence } from "@/shared/app/project-selection-persistence";
import { dashboardResources } from "@/shared/app/resources";
import {
  getDashboardExtensionsReadyProjectId,
  subscribeDashboardExtensionsReadyProject,
} from "@/shared/extensions/extension-readiness";
import { dashboardExtensionRouteKind } from "@/shared/extensions/workbench-extension-contributions";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { dashboardExtensionViewKind } from "./extensions/extension-view-placement";
import { createDashboardSessions } from "./sessions/data/dashboard-sessions";
import { createDashboardWorkspaces } from "./workspaces/data/dashboard-workspaces";

interface CreateBootstrapModuleInput {
  projectSelectionPersistence?: DashboardProjectSelectionPersistence;
}

interface LandingRunGuard {
  isCurrent(): boolean;
  onStale(resource: ResourceRef | undefined): void;
  onSettled(): void;
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

const isExtensionRestoreResource = (resource: ResourceRef) =>
  resource.kind === dashboardExtensionViewKind || resource.kind === dashboardExtensionRouteKind;

const shouldWaitForExtensions = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0], resource: ResourceRef) =>
  !isExtensionsReadyForSelectedProject(ctx) &&
  (isExtensionRestoreResource(resource) || !canOpenResource(ctx, resource));

const openSelectedProjectLanding = async (
  ctx: Parameters<WorkbenchModuleContribution["activate"]>[0],
  guard: LandingRunGuard,
) => {
  const lastResource = ctx.lastResource.get();

  if (lastResource) {
    if (isWaitingForSyncedResource(lastResource)) return "pending";

    if (isMissingSyncedResource(ctx, lastResource)) {
      ctx.lastResource.set(undefined);
      await ctx.resources.openResource(dashboardResources.start, {});
      return guard.isCurrent() ? { status: "opened" } : { resource: dashboardResources.start, status: "stale" };
    }

    if (shouldWaitForExtensions(ctx, lastResource)) return "pending";

    const restored = await ctx.lastResource.restore();
    if (restored) return guard.isCurrent() ? { status: "opened" } : { resource: lastResource, status: "stale" };
  }

  await ctx.resources.openResource(dashboardResources.start, {});
  return guard.isCurrent() ? { status: "opened" } : { resource: dashboardResources.start, status: "stale" };
};

const openSelectedProjectLandingWhenReady = (
  ctx: Parameters<WorkbenchModuleContribution["activate"]>[0],
  guard: LandingRunGuard,
) => {
  let unsubscribeDashboardData: (() => void) | undefined;
  let unsubscribeExtensionsReady: (() => void) | undefined;
  const dispose = () => {
    unsubscribeDashboardData?.();
    unsubscribeDashboardData = undefined;
    unsubscribeExtensionsReady?.();
    unsubscribeExtensionsReady = undefined;
  };
  const open = () => {
    void openSelectedProjectLanding(ctx, guard).then((result) => {
      if (result === "pending") return;
      guard.onSettled();
      dispose();
      if (result.status === "stale") guard.onStale(result.resource);
    });
  };

  open();
  const lastResource = ctx.lastResource.get();
  if (!lastResource) return undefined;

  const shouldWaitForSyncedResource = isWaitingForSyncedResource(lastResource);
  const shouldWaitForExtensionResource = shouldWaitForExtensions(ctx, lastResource);

  if (!shouldWaitForSyncedResource && !shouldWaitForExtensionResource) {
    return undefined;
  }

  if (shouldWaitForSyncedResource) unsubscribeDashboardData = subscribeDashboardData(open);
  if (shouldWaitForExtensionResource) unsubscribeExtensionsReady = subscribeDashboardExtensionsReadyProject(ctx, open);

  return { dispose };
};

// Boots the dashboard into the last-opened resource (handled by the workbench
// core's `lastResource` controller) and falls back to the project start
// view when nothing is saved. Also re-runs the landing flow whenever the
// selected project changes so each project lands on its own restored view.
export const createBootstrapModule = (input: CreateBootstrapModuleInput = {}) =>
  ({
    id: "dashboard.bootstrap",
    activate(ctx) {
      ctx.context.set("project.open", true);

      let landingDisposable: { dispose(): void } | undefined;
      let initialSyncWaitUnsubscribe: (() => void) | undefined;
      let landingRunId = 0;
      let currentExpectedResource: ResourceRef | undefined;

      const disposeLanding = () => {
        landingDisposable?.dispose();
        landingDisposable = undefined;
      };

      const cancelInitialSyncWait = () => {
        initialSyncWaitUnsubscribe?.();
        initialSyncWaitUnsubscribe = undefined;
      };

      const runLanding = () => {
        const runId = ++landingRunId;
        const projectId = getDashboardSelectedProjectId(ctx);
        currentExpectedResource = ctx.lastResource.get();
        disposeLanding();
        landingDisposable = openSelectedProjectLandingWhenReady(ctx, {
          isCurrent: () => runId === landingRunId && getDashboardSelectedProjectId(ctx) === projectId,
          onStale: (resource) => {
            if (!getDashboardSelectedProjectId(ctx)) return;
            if (currentExpectedResource?.uri !== resource?.uri) ctx.lastResource.set(currentExpectedResource);
            runLanding();
          },
          onSettled: () => undefined,
        });
      };

      const onSelectionChanged = () => {
        cancelInitialSyncWait();
        disposeLanding();

        if (getDashboardSelectedProjectId(ctx)) {
          runLanding();
          return;
        }

        openProjectSelection(ctx);
      };

      const persistedProjectId = input.projectSelectionPersistence?.getSelectedProjectId();

      if (getDashboardSelectedProjectId(ctx)) {
        runLanding();
      } else if (!persistedProjectId || isInitialCollectionsSyncComplete()) {
        openProjectSelection(ctx);
      } else {
        initialSyncWaitUnsubscribe = subscribeDashboardData(() => {
          if (!isInitialCollectionsSyncComplete()) return;
          cancelInitialSyncWait();

          if (!getDashboardSelectedProjectId(ctx)) {
            openProjectSelection(ctx);
            return;
          }

          runLanding();
        });
      }

      const unsubscribeProject = subscribeDashboardSelectedProject(ctx, onSelectionChanged);

      return {
        dispose() {
          unsubscribeProject();
          cancelInitialSyncWait();
          disposeLanding();
        },
      };
    },
  }) satisfies WorkbenchModuleContribution;
