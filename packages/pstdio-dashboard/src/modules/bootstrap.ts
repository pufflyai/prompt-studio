import { isWorkbenchViewHierarchyNode, type ResourceRef, type WorkbenchModuleContribution } from "@pstdio/workbench";
import { isInitialCollectionsSyncComplete } from "@/lib/sync/collections";
import { dashboardCommandIds } from "@/shared/app/commands";
import { getExtensionLandingPageId } from "@/shared/app/extension-landing-page";
import type { DashboardLastResourcePersistence } from "@/shared/app/last-resource-persistence";
import { registerDashboardPageNavigation } from "@/shared/app/page-navigation";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import type { DashboardProjectSelectionPersistence } from "@/shared/app/project-selection-persistence";
import { dashboardViews } from "@/shared/app/resources";
import type { DashboardSessionSelectionPersistence } from "@/shared/app/session-selection-persistence";
import {
  getDashboardExtensionsReadyProjectId,
  hasDashboardExtensionsModule,
  subscribeDashboardExtensionsReadyProject,
} from "@/shared/extensions/extension-readiness";
import { subscribeDashboardData } from "@/shared/sync/dashboard-rows";
import { migrateLegacyViewHistory, resolvePersistedViewId } from "./extensions/view-persistence-migration";
import { createDashboardSessions } from "./sessions/data/dashboard-sessions";
import { createDashboardWorkspaces } from "./workspaces/data/dashboard-workspaces";

interface CreateBootstrapModuleInput {
  initialViewPath?: string;
  lastResourcePersistence?: DashboardLastResourcePersistence;
  projectSelectionPersistence?: DashboardProjectSelectionPersistence;
  sessionSelectionPersistence?: DashboardSessionSelectionPersistence;
}

interface LandingRunGuard {
  isCurrent(): boolean;
  lastResourcePersistence?: DashboardLastResourcePersistence;
  requestedViewPath?: string;
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

// True while this project's extension contributions are still coming. A workbench
// with no extensions module never waits.
const isExtensionsPendingForSelectedProject = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0]) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  if (!projectId || isExtensionsReadyForSelectedProject(ctx)) return false;
  return hasDashboardExtensionsModule(ctx);
};

const hasHistoryForSelectedProject = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0]) => {
  const projectId = getDashboardSelectedProjectId(ctx);
  return Boolean(
    projectId &&
      ctx.history.getPersistenceScope() === `project:${projectId}` &&
      ctx.history.store.getState().entries.length > 0,
  );
};

const shouldWaitForExtensions = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0], resource: ResourceRef) =>
  !isExtensionsReadyForSelectedProject(ctx) && !canOpenResource(ctx, resource);

const shouldWaitForHistoryExtensions = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0]) => {
  if (!hasHistoryForSelectedProject(ctx) || isExtensionsReadyForSelectedProject(ctx)) return false;

  const history = ctx.history.store.getState();
  const entry = history.entries[history.cursor];
  if (!entry) return false;
  if (entry.kind === "page" && entry.pageId) return !ctx.pages.registry.getPage(entry.pageId);
  if (entry.viewId) return !isExtensionsReadyForSelectedProject(ctx) && !ctx.views.canResolveView(entry.viewId);
  if (entry.resource) return shouldWaitForExtensions(ctx, entry.resource);
  if (entry.modeId && !ctx.modes.getMode(entry.modeId)) return true;
  return Boolean(entry.contributionId && !ctx.layout.getWidget(entry.contributionId));
};

const restoreSelectedProjectHistory = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0]) => {
  if (!hasHistoryForSelectedProject(ctx)) return "empty" as const;
  if (shouldWaitForHistoryExtensions(ctx)) return "pending" as const;
  ctx.history.migrateState((state) => migrateLegacyViewHistory(state, ctx.views));
  return ctx.history.restore() ? ("restored" as const) : ("empty" as const);
};

// When nothing restores, the host activates the first project-navigation item with a
// page target; a project with no UI extensions lands on the start host page. The
// fallback is itself a page, so the location model has no special case.
const openLandingPage = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0]) => {
  const landingPageId = getExtensionLandingPageId(ctx);
  if (landingPageId && ctx.pages.registry.getPage(landingPageId)) return ctx.pages.activatePage(landingPageId);
  return ctx.views.openView(dashboardViews.start.id);
};

// A URL deep link beats the persisted history and last location on boot. The location
// resolves through the page URL scheme (host segments plus extension namespaces).
const restoreRequestedView = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0], guard: LandingRunGuard) => {
  if (!guard.requestedViewPath) return "empty" as const;
  let target: ReturnType<typeof ctx.navigation.resolveLocation> | undefined;
  try {
    target = ctx.navigation.resolveLocation(guard.requestedViewPath);
  } catch {
    target = undefined;
  }
  if (!target || target.kind !== "page") {
    const legacyView = ctx.views.resolvePath(guard.requestedViewPath);
    if (!legacyView || !ctx.views.canResolveView(legacyView.viewId)) {
      return isExtensionsReadyForSelectedProject(ctx) ? ("missing" as const) : ("pending" as const);
    }
    const history = ctx.history.store.getState();
    const currentEntry = history.entries[history.cursor];
    const resourceBelongsToLegacyView = currentEntry?.resource
      ? ctx.resources
          .walkHierarchy(currentEntry.resource)
          .some(
            (node) => isWorkbenchViewHierarchyNode(node) && ctx.views.resolveViewId(node.viewId) === legacyView.viewId,
          )
      : false;
    if (
      (currentEntry?.viewId && ctx.views.resolveViewId(currentEntry.viewId) === legacyView.viewId) ||
      resourceBelongsToLegacyView
    ) {
      return "empty" as const;
    }
    return ctx.views
      .openView(legacyView.viewId, { strategy: { kind: "replace-active" } })
      .then(() =>
        guard.isCurrent() ? ({ status: "opened" } as const) : ({ resource: undefined, status: "stale" } as const),
      );
  }
  const location = ctx.pages.getActiveLocation();
  if (location && location.pageId === target.pageId && location.resource?.uri === target.resource?.uri) {
    return "empty" as const;
  }
  // A reload lands at the URL of the location the user was already on. When the
  // persisted history top matches the URL, the history restore owns the boot so tab
  // arrangement and selections come back with it.
  const history = ctx.history.store.getState();
  const currentEntry = history.entries[history.cursor];
  if (
    currentEntry?.kind === "page" &&
    currentEntry.pageId === target.pageId &&
    currentEntry.resource?.uri === target.resource?.uri
  ) {
    return "empty" as const;
  }
  return ctx.navigation
    .openTarget(target)
    .then(() =>
      guard.isCurrent() ? ({ status: "opened" } as const) : ({ resource: undefined, status: "stale" } as const),
    );
};

const restoreLegacyView = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0], guard: LandingRunGuard) => {
  const legacyView = guard.lastResourcePersistence?.getLegacyViewResource();
  if (!legacyView) return "empty" as const;

  const routePath = legacyView.metadata?.routePath;
  const route = typeof routePath === "string" ? ctx.views.resolvePath(routePath) : undefined;
  const viewId = route?.viewId ?? resolvePersistedViewId(legacyView.id, ctx.views);
  if (viewId && ctx.views.canResolveView(viewId)) {
    return ctx.views.openView(viewId, { strategy: { kind: "replace-active" } }).then(() => {
      if (!guard.isCurrent()) return { resource: undefined, status: "stale" } as const;
      guard.lastResourcePersistence?.clearLegacyViewResource();
      return { status: "opened" } as const;
    });
  }
  if (!isExtensionsReadyForSelectedProject(ctx)) return "pending" as const;
  guard.lastResourcePersistence?.clearLegacyViewResource();
  return "empty" as const;
};

const restoreLastResource = (ctx: Parameters<WorkbenchModuleContribution["activate"]>[0], guard: LandingRunGuard) => {
  const lastResource = ctx.lastResource.get();
  if (!lastResource) return "empty" as const;
  if (isWaitingForSyncedResource(lastResource)) return "pending" as const;

  if (isMissingSyncedResource(ctx, lastResource)) {
    ctx.lastResource.set(undefined);
    return openLandingPage(ctx).then(() =>
      guard.isCurrent() ? ({ status: "opened" } as const) : ({ resource: undefined, status: "stale" } as const),
    );
  }

  if (shouldWaitForExtensions(ctx, lastResource)) return "pending" as const;
  return ctx.lastResource.restore().then((restored) => {
    if (!restored) return "empty" as const;
    return guard.isCurrent() ? ({ status: "opened" } as const) : ({ resource: lastResource, status: "stale" } as const);
  });
};

const openSelectedProjectLanding = async (
  ctx: Parameters<WorkbenchModuleContribution["activate"]>[0],
  guard: LandingRunGuard,
) => {
  const requestedViewRestore = restoreRequestedView(ctx, guard);
  if (requestedViewRestore === "pending") return "pending";
  if (requestedViewRestore === "missing") {
    await openLandingPage(ctx);
    return guard.isCurrent() ? ({ status: "opened" } as const) : { resource: undefined, status: "stale" as const };
  }
  if (requestedViewRestore !== "empty") return await requestedViewRestore;

  const historyRestore = restoreSelectedProjectHistory(ctx);
  if (historyRestore === "pending") return "pending";
  if (historyRestore === "restored") return { status: "opened" } as const;

  const legacyRestore = restoreLegacyView(ctx, guard);
  if (legacyRestore === "pending") return "pending";
  if (legacyRestore !== "empty") return await legacyRestore;

  const lastResourceRestore = restoreLastResource(ctx, guard);
  if (lastResourceRestore === "pending") return "pending";
  if (lastResourceRestore !== "empty") {
    const restored = await lastResourceRestore;
    if (restored !== "empty") return restored;
  }

  // The landing rule reads the extension navigation items, so the choice between an
  // extension page and the start page is only deterministic once extensions are ready.
  if (isExtensionsPendingForSelectedProject(ctx)) return "pending";

  await openLandingPage(ctx);
  return guard.isCurrent() ? ({ status: "opened" } as const) : { resource: undefined, status: "stale" as const };
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
  const legacyView = guard.lastResourcePersistence?.getLegacyViewResource();
  const shouldWaitForHistory = shouldWaitForHistoryExtensions(ctx);
  const requestedView = guard.requestedViewPath ? ctx.views.resolvePath(guard.requestedViewPath) : undefined;
  const shouldWaitForRequestedView = Boolean(
    guard.requestedViewPath &&
      (!requestedView || !ctx.views.canResolveView(requestedView.viewId)) &&
      !isExtensionsReadyForSelectedProject(ctx),
  );
  // The landing choice itself waits for extensions (see openSelectedProjectLanding).
  const shouldWaitForLandingChoice = isExtensionsPendingForSelectedProject(ctx);
  if (
    !lastResource &&
    !legacyView &&
    !shouldWaitForHistory &&
    !shouldWaitForRequestedView &&
    !shouldWaitForLandingChoice
  ) {
    return undefined;
  }

  const shouldWaitForSyncedResource = lastResource ? isWaitingForSyncedResource(lastResource) : false;
  const shouldWaitForExtensionResource = lastResource ? shouldWaitForExtensions(ctx, lastResource) : false;
  const shouldWaitForLegacyView = Boolean(legacyView && !isExtensionsReadyForSelectedProject(ctx));

  if (
    !shouldWaitForSyncedResource &&
    !shouldWaitForExtensionResource &&
    !shouldWaitForLegacyView &&
    !shouldWaitForHistory &&
    !shouldWaitForRequestedView &&
    !shouldWaitForLandingChoice
  ) {
    return undefined;
  }

  if (shouldWaitForSyncedResource) unsubscribeDashboardData = subscribeDashboardData(open);
  if (
    shouldWaitForExtensionResource ||
    shouldWaitForLegacyView ||
    shouldWaitForHistory ||
    shouldWaitForRequestedView ||
    shouldWaitForLandingChoice
  ) {
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
      registerDashboardPageNavigation(ctx);

      let landingDisposable: { dispose(): void } | undefined;
      let initialSyncWaitUnsubscribe: (() => void) | undefined;
      let landingRunId = 0;
      let currentExpectedResource: ResourceRef | undefined;
      let requestedViewPath = input.initialViewPath;

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
          lastResourcePersistence: input.lastResourcePersistence,
          requestedViewPath,
          onStale: (resource) => {
            requestedViewPath = undefined;
            if (!getDashboardSelectedProjectId(ctx)) return;
            if (currentExpectedResource?.uri !== resource?.uri) ctx.lastResource.set(currentExpectedResource);
            runLanding();
          },
          onSettled: () => {
            requestedViewPath = undefined;
            // The boot landed somewhere other than the persisted history top (URL
            // deep link, landing page): finish hydration by adopting the current
            // location, or every navigation control stays disabled.
            ctx.history.adoptCurrentLocation();
            void restoreSelectedSession(ctx, selectedSessionId);
          },
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
