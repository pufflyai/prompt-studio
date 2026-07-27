import type {
  WorkbenchExtensionMetadata as DashboardExtensionMetadata,
  ListExtensionAppearanceResponse,
} from "@pstdio/sdk/api";
import type { Disposable, ResourceRef, WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
import { createElement } from "react";
import i18n from "@/i18n";
import { type CollectionChange, subscribeCollections } from "@/lib/sync/collections";
import { selectDashboardNavigationResource } from "@/shared/app/navigation-state";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import {
  executeExtensionCommand,
  getProjectExtensionAppearance,
  getProjectExtensionMetadata,
} from "@/shared/extensions/api";
import {
  localizeExtensionMetadata,
  type ResolvedWorkbenchExtensionMetadata,
} from "@/shared/extensions/extension-localization";
import {
  clearDashboardExtensionsReadyProject,
  setDashboardExtensionsReadyProject,
} from "@/shared/extensions/extension-readiness";
import {
  buildDashboardExtensionRouteEntries,
  clearCachedDashboardExtensionMetadata,
  createDashboardExtensionRouteResource,
  dashboardExtensionRouteKind,
  emptyDashboardExtensionMetadata,
  getCachedDashboardExtensionMetadata,
  setCachedDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { setResourceBreadcrumb } from "@/shared/workbench/resource-sync";
import { syncActiveResourceContext } from "./active-resource-context";
import { ExtensionRouteWidget } from "./components/extension-route-widget";
import { ExtensionViewWidget } from "./components/extension-view-widget";
import { emptyDashboardExtensionAppearance, registerExtensionAppearance } from "./extension-appearance";
import type { ExecuteDashboardExtensionCommand } from "./extension-command-handler";
import {
  captureExtensionContributionRefreshLayout,
  restoreExtensionContributionRefreshLayout,
} from "./extension-contribution-refresh-layout";
import { disposeExtensionContributions, registerExtensionContributions } from "./extension-contribution-registration";
import { createExtensionRefreshQueue } from "./extension-refresh-queue";
import { refreshOpenExtensionRoutes } from "./extension-route-refresh";
import { registerExtensionSidenavContributions } from "./extension-sidenav-contributions";
import { dashboardExtensionViewKind, extensionViewRegion, extensionViewWidgetIdFor } from "./extension-view-placement";

type LoadDashboardExtensionMetadata = (projectId: string) => Promise<DashboardExtensionMetadata>;
type LoadDashboardExtensionAppearance = (projectId: string) => Promise<ListExtensionAppearanceResponse>;

interface CreateExtensionsModuleInput {
  executeCommand?: ExecuteDashboardExtensionCommand;
  loadAppearance?: LoadDashboardExtensionAppearance;
  loadMetadata?: LoadDashboardExtensionMetadata;
}

const extensionSyncTables = new Set<CollectionChange["table"]>(["installed_extension_sources", "extension_instances"]);

const hasSameSerializedMetadata = (
  current: ResolvedWorkbenchExtensionMetadata | undefined,
  next: ResolvedWorkbenchExtensionMetadata,
) => Boolean(current && JSON.stringify(current) === JSON.stringify(next));

const resourceProjectId = (resource: ResourceRef | undefined) => {
  const projectId = resource?.metadata?.projectId;
  if (typeof projectId === "string") return projectId;

  const favoriteScope = resource?.metadata?.favoriteScope;
  if (!favoriteScope || typeof favoriteScope !== "object") return undefined;

  const scope = favoriteScope as { scope?: unknown; projectId?: unknown };
  return scope.scope === "project" && typeof scope.projectId === "string" ? scope.projectId : undefined;
};

const restorePrimaryResourceIfRefreshClearedIt = (
  ctx: WorkbenchModuleContext,
  input: { projectId: string; resource: ResourceRef | undefined },
) => {
  if (!input.resource) return;
  if (ctx.getPrimaryResource()) return;
  if (resourceProjectId(input.resource) !== input.projectId) return;

  void ctx.resources.openResource(input.resource, { replaceActive: true }).catch(() => undefined);
};

const resolveAvailableRouteResource = (resource: ResourceRef, fallbackProjectId: string | undefined) => {
  const routeProjectId =
    typeof resource.metadata?.projectId === "string" ? resource.metadata.projectId : fallbackProjectId;
  const routePath = typeof resource.metadata?.routePath === "string" ? resource.metadata.routePath : resource.id;
  const route = getCachedDashboardExtensionMetadata(routeProjectId)?.routes.find(
    (candidate) => candidate.path === routePath,
  );
  if (!route) throw new Error(`Extension route is not available: ${routePath}`);
  if (!routeProjectId) throw new Error(`Extension route has no project: ${routePath}`);
  return createDashboardExtensionRouteResource({ icon: resource.icon, projectId: routeProjectId, route });
};

// Extension metadata is fetched per project and re-applied whenever the active
// project or installed-extension collections change.
export const createExtensionsModule = (input: CreateExtensionsModuleInput = {}) =>
  ({
    id: "dashboard.extensions",
    activate(ctx: WorkbenchModuleContext) {
      const executeCommand = input.executeCommand ?? executeExtensionCommand;
      const loadAppearance = input.loadAppearance ?? getProjectExtensionAppearance;
      const loadMetadata = input.loadMetadata ?? getProjectExtensionMetadata;
      let projectId = getDashboardSelectedProjectId(ctx);
      let rawAppearance: ListExtensionAppearanceResponse | undefined;
      let rawMetadata: DashboardExtensionMetadata | undefined;
      let metadata: ResolvedWorkbenchExtensionMetadata | undefined;
      let projectGeneration = 0;
      let appearanceDisposable: Disposable | undefined;
      let contributionDisposables: Disposable[] = [];
      let primaryResourceBeforeRefresh: ResourceRef | undefined;

      const clearContributions = () => {
        disposeExtensionContributions(contributionDisposables);
        contributionDisposables = [];
      };

      const clearAppearance = () => {
        appearanceDisposable?.dispose();
        appearanceDisposable = undefined;
      };

      const applyAppearance = (nextAppearance: ListExtensionAppearanceResponse) => {
        rawAppearance = nextAppearance;
        clearAppearance();
        appearanceDisposable = registerExtensionAppearance(ctx, nextAppearance);
      };

      const applyMetadata = (nextProjectId: string, nextMetadata: DashboardExtensionMetadata) => {
        const nextResolvedMetadata = localizeExtensionMetadata(nextMetadata);
        const contributionsAreCurrent = hasSameSerializedMetadata(metadata, nextResolvedMetadata);
        const currentPrimaryResource = ctx.getPrimaryResource();
        if (resourceProjectId(currentPrimaryResource) === nextProjectId) {
          primaryResourceBeforeRefresh = currentPrimaryResource;
        }

        rawMetadata = nextMetadata;
        metadata = nextResolvedMetadata;
        setCachedDashboardExtensionMetadata(nextProjectId, metadata);
        if (contributionsAreCurrent) {
          primaryResourceBeforeRefresh = undefined;
          setDashboardExtensionsReadyProject(ctx, nextProjectId);
          return;
        }
        const refreshLayout = captureExtensionContributionRefreshLayout(ctx);
        clearContributions();
        contributionDisposables = registerExtensionContributions({
          ctx,
          executeCommand,
          metadata,
          projectId: nextProjectId,
          onRegistrationError: (error, extensionId) => {
            const message = error instanceof Error ? error.message : String(error);
            console.error(`[dashboard.extensions:${extensionId}] contribution registration failed: ${message}`);
          },
        });
        restoreExtensionContributionRefreshLayout(ctx, refreshLayout);
        if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidenav)) {
          ctx.renderers.refresh(dashboardWidgetIds.dashboardSidenav);
        }
        refreshOpenExtensionRoutes(ctx, metadata, nextProjectId);
        restorePrimaryResourceIfRefreshClearedIt(ctx, {
          projectId: nextProjectId,
          resource: primaryResourceBeforeRefresh,
        });
        primaryResourceBeforeRefresh = undefined;
        setDashboardExtensionsReadyProject(ctx, nextProjectId);
      };

      const metadataRefresh = createExtensionRefreshQueue({
        apply: applyMetadata,
        fallback: emptyDashboardExtensionMetadata,
        getGeneration: () => projectGeneration,
        getProjectId: () => projectId,
        load: loadMetadata,
      });
      const appearanceRefresh = createExtensionRefreshQueue({
        apply: (nextProjectId, nextAppearance) => {
          applyAppearance(nextAppearance);
          if (rawMetadata) applyMetadata(nextProjectId, rawMetadata);
        },
        fallback: emptyDashboardExtensionAppearance,
        getGeneration: () => projectGeneration,
        getProjectId: () => projectId,
        load: loadAppearance,
      });

      const refreshProject = () => {
        const previousProjectId = projectId;
        projectId = getDashboardSelectedProjectId(ctx);
        const currentPrimaryResource = ctx.getPrimaryResource();
        primaryResourceBeforeRefresh =
          resourceProjectId(currentPrimaryResource) === projectId ? currentPrimaryResource : undefined;

        // On a project switch, stale contributions and caches must go immediately even
        // if the new fetch never resolves. Same-project refreshes (extension installs
        // and webview builds emit collection churn for seconds) keep everything live
        // until fresh metadata arrives — applyMetadata swaps contributions
        // synchronously, so the sidenav never renders entries whose presenters are gone.
        if (projectId !== previousProjectId || !projectId) {
          projectGeneration += 1;
          metadataRefresh.clear();
          appearanceRefresh.clear();
          rawAppearance = undefined;
          rawMetadata = undefined;
          metadata = undefined;
          clearCachedDashboardExtensionMetadata(previousProjectId);
          clearCachedDashboardExtensionMetadata(projectId);
          clearDashboardExtensionsReadyProject(ctx);
          clearContributions();
          clearAppearance();
        }

        if (!projectId) return;
        metadataRefresh.refresh(projectId);
        appearanceRefresh.refresh(projectId);
      };

      const reapplyLocale = () => {
        if (!projectId || !rawMetadata || !rawAppearance) return;
        applyAppearance(rawAppearance);
        applyMetadata(projectId, rawMetadata);
      };

      // Extension tree renderers (e.g. the ticket "Workspaces" list) fetch their body
      // imperatively, so a row inserted by a command like run-attempt only appears after a
      // refresh. Re-run them whenever the realtime collection feed reports a domain-data
      // change instead of re-syncing by hand.
      const refreshExtensionRenderers = () => {
        for (const record of metadata?.treeRenderers ?? []) {
          if (ctx.renderers.getTreeRenderer(record.id)) ctx.renderers.refresh(record.id);
        }
      };

      ctx.resources.registerKind({ kind: dashboardExtensionRouteKind, label: "Extension route", icon: "PanelLeft" });
      ctx.resources.registerKind({ kind: dashboardExtensionViewKind, label: "Extension view", icon: "PanelLeft" });
      registerExtensionSidenavContributions(ctx, () => ({ metadata, projectId }));
      ctx.layout.registerPanel(
        {
          closable: false,
          id: dashboardWidgetIds.extensionRoute,
          title: "Extension route",
          region: "main",
          singleton: true,
          rendererId: dashboardWidgetIds.extensionRoute,
          priority: 70,
        },
        { priority: 70 },
      );
      ctx.renderers.registerRenderer({
        id: dashboardWidgetIds.extensionRoute,
        render: (renderInput) => createElement(ExtensionRouteWidget, { input: renderInput }),
      });
      ctx.renderers.registerRenderer({
        id: dashboardWidgetIds.extensionView,
        render: (renderInput) => createElement(ExtensionViewWidget, { input: renderInput }),
      });
      ctx.resources.registerProvider({
        id: "dashboard-workbench.extension-routes",
        kind: dashboardExtensionRouteKind,
        list: () => buildDashboardExtensionRouteEntries({ metadata, projectId }),
      });
      // A mode-layout view docked in the primary region (e.g. an extension overview) is recorded
      // as an `extension-view` history landmark. Back/Forward replay reopens it through this
      // presenter, which re-derives the view from the cached manifest and re-places the widget.
      // Without it, replaying that entry would silently leave the primary region desynced from the
      // history cursor (there is no presenter for the synthetic `extension-view` kind otherwise).
      ctx.resources.registerPresenter({
        id: "dashboard.extensions.panel-presenter",
        priority: 1000,
        canOpen: (resource) => resource.kind === dashboardExtensionViewKind,
        open: (resource, openInput) => {
          const viewProjectId =
            typeof resource.metadata?.projectId === "string" ? resource.metadata.projectId : projectId;
          const view = getCachedDashboardExtensionMetadata(viewProjectId)?.panels.find(
            (candidate) => candidate.id === resource.id,
          );
          if (!view) throw new Error(`Extension view is not available: ${resource.id}`);
          selectDashboardNavigationResource(ctx, resource);
          return ctx.layout.openPanel(extensionViewWidgetIdFor(view), {
            strategy: openInput.replaceActive ? { kind: "replace-active" } : { kind: "activate-or-open" },
            resource,
            region: extensionViewRegion(view.region),
            title: resource.label,
          });
        },
      });
      ctx.resources.registerPresenter({
        id: "dashboard.extensions.route-presenter",
        priority: 1000,
        canOpen: (resource) => resource.kind === dashboardExtensionRouteKind,
        open: (resource, openInput) => {
          const availableResource = resolveAvailableRouteResource(resource, projectId);
          selectDashboardNavigationResource(ctx, availableResource, { modeId: "project" });
          setResourceBreadcrumb(ctx, availableResource);
          if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidenav)) {
            ctx.renderers.setSelectedNode(dashboardWidgetIds.dashboardSidenav, availableResource.uri);
          }
          return ctx.layout.openPanel(dashboardWidgetIds.extensionRoute, {
            strategy: openInput.replaceActive ? { kind: "replace-active" } : { kind: "activate-or-open" },
            resource: availableResource,
            title: availableResource.label,
          });
        },
      });

      const activeResourceContext = syncActiveResourceContext(ctx);

      refreshProject();
      i18n.on("languageChanged", reapplyLocale);
      const unsubscribeProject = subscribeDashboardSelectedProject(ctx, refreshProject);
      const unsubscribeSync = subscribeCollections((change) => {
        if (!change) return;
        if (extensionSyncTables.has(change.table)) {
          refreshProject();
          return;
        }
        refreshExtensionRenderers();
      });

      return {
        dispose() {
          projectGeneration += 1;
          metadataRefresh.clear();
          appearanceRefresh.clear();
          activeResourceContext.dispose();
          clearCachedDashboardExtensionMetadata(projectId);
          clearDashboardExtensionsReadyProject(ctx);
          clearContributions();
          clearAppearance();
          i18n.off("languageChanged", reapplyLocale);
          unsubscribeProject();
          unsubscribeSync();
        },
      };
    },
  }) satisfies WorkbenchModuleContribution;
