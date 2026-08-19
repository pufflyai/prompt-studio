import type { ResourceRef, WorkbenchModuleContribution } from "@pstdio/workbench";
import { isInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import type { DashboardProjectSelectionPersistence } from "@/shared/app/project-selection-persistence";
import { dashboardResources } from "@/shared/app/resources";
import type { DashboardSessionSelectionPersistence } from "@/shared/app/session-selection-persistence";
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
  sessionSelectionPersistence?: DashboardSessionSelectionPersistence;
}

interface LandingRunGuard {
  isCurrent(): boolean;
  onStale(resource: ResourceRef | undefined): void;
  onSettled(): void;
}

const openProjectSelection = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0]) => {
  ctx.navigator.commitContext({ modeId: "project-selection", resource: null });
};

const canOpenResource = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0], resource: ResourceRef) =>
  Boolean(ctx.resources.getKind(resource.kind)) &&
  ctx.resources.listPresenters().some((presenter) => presenter.canOpen(resource));

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

const hasHistoryForSelectedProject = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0]) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  return Boolean(
    projectId &&
      ctx.history.getPersistenceScope() === `project:${projectId}` &&
      ctx.history.store.getState().entries.length > 0,
  );
};

const isExtensionRestoreResource = (resource: ResourceRef) =>
  resource.kind === dashboardExtensionViewKind || resource.kind === dashboardExtensionRouteKind;

const shouldWaitForExtensions = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0], resource: ResourceRef) =>
  !isExtensionsReadyForSelectedProject(ctx) &&
  (isExtensionRestoreResource(resource) || !canOpenResource(ctx, resource));

const restoreSelectedProjectHistory = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0]) => {
  if (!hasHistoryForSelectedProject(ctx)) return "empty" as const;
  if (!isExtensionsReadyForSelectedProject(ctx)) return "pending" as const;
  return ctx.history.restore() ? ("restored" as const) : ("empty" as const);
};

const openSelectedProjectLanding = async (
  ctx: Parameters<WorkbenchModuleContribution["activate"]>[0],
  guard: LandingRunGuard,
) => {
  const historyRestore = restoreSelectedProjectHistory(ctx);
  if (historyRestore === "pending") return "pending";
  if (historyRestore === "restored") return { status: "opened" } as const;

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

// The Side Panel session is restored after the landing view, so the primary resource and the
// layout scope it selects are already in place and the session lands in the right scope. A
// session that no longer exists is simply skipped.
const restoreSelectedSession = async (
  ctx: Parameters<WorkbenchModuleContribution["activate"]>[0],
  sessionId: string | undefined,
) => {
  if (!sessionId || !ctx.commands.getCommand(dashboardCommandIds.openSessionPanel)) return;

  const session = createDashboardSessions(getDashboardSelectedProjectId(ctx)).find(
    (candidate) => candidate.id === sessionId,
  );
  if (!session) return;

  await ctx.commands.executeCommand(dashboardCommandIds.openSessionPanel, {
    preservePanelMode: true,
    resource: session.resource,
    tabPosition: "start",
  });
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
      dispose();
      if (result.status === "stale") {
        guard.onStale(result.resource);
        return;
      }
      guard.onSettled();
    });
  };

  open();
  const lastResource = ctx.lastResource.get();
  const shouldWaitForHistory = hasHistoryForSelectedProject(ctx) && !isExtensionsReadyForSelectedProject(ctx);
  if (!lastResource && !shouldWaitForHistory) return undefined;

  const shouldWaitForSyncedResource = lastResource ? isWaitingForSyncedResource(lastResource) : false;
  const shouldWaitForExtensionResource = lastResource ? shouldWaitForExtensions(ctx, lastResource) : false;

  if (!shouldWaitForSyncedResource && !shouldWaitForExtensionResource && !shouldWaitForHistory) {
    return undefined;
  }

  if (shouldWaitForSyncedResource) unsubscribeDashboardData = subscribeDashboardData(open);
  if (shouldWaitForExtensionResource || shouldWaitForHistory) {
    unsubscribeExtensionsReady = subscribeDashboardExtensionsReadyProject(ctx, open);
  }

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
        // Read before landing: opening the landing resource auto-opens its own session, which
        // overwrites the stored selection this run is meant to restore.
        const selectedSessionId = input.sessionSelectionPersistence?.getSelectedSessionId();
        currentExpectedResource = ctx.lastResource.get();
        disposeLanding();
        landingDisposable = openSelectedProjectLandingWhenReady(ctx, {
          isCurrent: () => runId === landingRunId && getDashboardSelectedProjectId(ctx) === projectId,
          onStale: (resource) => {
            if (!getDashboardSelectedProjectId(ctx)) return;
            if (currentExpectedResource?.uri !== resource?.uri) ctx.lastResource.set(currentExpectedResource);
            runLanding();
          },
          onSettled: () => void restoreSelectedSession(ctx, selectedSessionId),
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
