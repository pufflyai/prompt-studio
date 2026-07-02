import type {
  WorkbenchExtensionMetadata as DashboardExtensionMetadata,
  ListExtensionAppearanceResponse,
} from "@pstdio/sdk/api";
import type {
  Disposable,
  ResourceRef,
  WorkbenchModuleContribution,
  WorkbenchModuleContributionContext,
} from "pstdio-workbench/core";
import { createElement } from "react";
import i18n from "@/i18n";
import { type CollectionChange, subscribeCollections } from "@/lib/sync/collections";
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
import { disposeExtensionContributions, registerExtensionContributions } from "./extension-contribution-registration";
import { refreshOpenExtensionRoutes } from "./extension-route-refresh";
import { registerExtensionSidebarContributions } from "./extension-sidebar-contributions";
import { dashboardExtensionViewKind, extensionViewArea, extensionViewWidgetIdFor } from "./extension-view-placement";

type LoadDashboardExtensionMetadata = (projectId: string) => Promise<DashboardExtensionMetadata>;
type LoadDashboardExtensionAppearance = (projectId: string) => Promise<ListExtensionAppearanceResponse>;

interface CreateExtensionsModuleInput {
  executeCommand?: ExecuteDashboardExtensionCommand;
  loadAppearance?: LoadDashboardExtensionAppearance;
  loadMetadata?: LoadDashboardExtensionMetadata;
}

const extensionSyncTables = new Set<CollectionChange["table"]>(["installed_extension_sources", "extension_instances"]);

const resourceProjectId = (resource: ResourceRef | undefined) => {
  const projectId = resource?.metadata?.projectId;
  if (typeof projectId === "string") return projectId;

  const favoriteScope = resource?.metadata?.favoriteScope;
  if (!favoriteScope || typeof favoriteScope !== "object") return undefined;

  const scope = favoriteScope as { scope?: unknown; projectId?: unknown };
  return scope.scope === "project" && typeof scope.projectId === "string" ? scope.projectId : undefined;
};

const restorePrimaryResourceIfRefreshClearedIt = (
  ctx: WorkbenchModuleContributionContext,
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
  return route;
};

// Extension metadata is fetched per project and re-applied whenever the active
// project or installed-extension collections change.
export const createExtensionsModule = (input: CreateExtensionsModuleInput = {}) =>
  ({
    id: "dashboard.extensions",
    activate(ctx: WorkbenchModuleContributionContext) {
      const executeCommand = input.executeCommand ?? executeExtensionCommand;
      const loadAppearance = input.loadAppearance ?? getProjectExtensionAppearance;
      const loadMetadata = input.loadMetadata ?? getProjectExtensionMetadata;
      let projectId = getDashboardSelectedProjectId(ctx);
      let rawAppearance: ListExtensionAppearanceResponse | undefined;
      let rawMetadata: DashboardExtensionMetadata | undefined;
      let metadata: ResolvedWorkbenchExtensionMetadata | undefined;
      let requestId = 0;
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
        const currentPrimaryResource = ctx.getPrimaryResource();
        if (resourceProjectId(currentPrimaryResource) === nextProjectId) {
          primaryResourceBeforeRefresh = currentPrimaryResource;
        }

        rawMetadata = nextMetadata;
        metadata = localizeExtensionMetadata(nextMetadata);
        setCachedDashboardExtensionMetadata(nextProjectId, metadata);
        clearContributions();
        contributionDisposables = registerExtensionContributions({
          ctx,
          executeCommand,
          metadata,
          projectId: nextProjectId,
        });
        if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidebar)) {
          ctx.renderers.refresh(dashboardWidgetIds.dashboardSidebar);
        }
        refreshOpenExtensionRoutes(ctx, metadata, nextProjectId);
        restorePrimaryResourceIfRefreshClearedIt(ctx, {
          projectId: nextProjectId,
          resource: primaryResourceBeforeRefresh,
        });
        primaryResourceBeforeRefresh = undefined;
        setDashboardExtensionsReadyProject(ctx, nextProjectId);
      };

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
        // synchronously, so the sidebar never renders entries whose openers are gone.
        if (projectId !== previousProjectId || !projectId) {
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

        requestId += 1;
        const currentRequestId = requestId;
        void loadMetadata(projectId)
          .catch(() => emptyDashboardExtensionMetadata)
          .then((nextMetadata) => {
            if (currentRequestId !== requestId || !projectId) return;
            applyMetadata(projectId, nextMetadata);
          });

        void loadAppearance(projectId)
          .catch(() => emptyDashboardExtensionAppearance)
          .then((nextAppearance) => {
            if (currentRequestId !== requestId || !projectId) return;
            applyAppearance(nextAppearance);
            if (rawMetadata) applyMetadata(projectId, rawMetadata);
          });
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
      registerExtensionSidebarContributions(ctx, () => ({ metadata, projectId }));
      ctx.layout.registerWidget(
        {
          id: dashboardWidgetIds.extensionRoute,
          title: "Extension route",
          area: "main",
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
      // A mode-layout view docked in the primary area (e.g. an extension overview) is recorded
      // as an `extension-view` history landmark. Back/Forward replay reopens it through this
      // opener, which re-derives the view from the cached manifest and re-places the widget.
      // Without it, replaying that entry would silently leave the primary area desynced from the
      // history cursor (there is no opener for the synthetic `extension-view` kind otherwise).
      ctx.resources.registerOpener({
        id: "dashboard.extensions.view-opener",
        priority: 1000,
        canOpen: (resource) => resource.kind === dashboardExtensionViewKind,
        open: (resource, openInput) => {
          const viewProjectId =
            typeof resource.metadata?.projectId === "string" ? resource.metadata.projectId : projectId;
          const view = getCachedDashboardExtensionMetadata(viewProjectId)?.views.find(
            (candidate) => candidate.id === resource.id,
          );
          if (!view) throw new Error(`Extension view is not available: ${resource.id}`);
          return ctx.layout.openWidget(extensionViewWidgetIdFor(view), {
            resource,
            area: extensionViewArea(view.target),
            title: resource.label,
            replaceActive: openInput.replaceActive,
          });
        },
      });
      ctx.resources.registerOpener({
        id: "dashboard.extensions.route-opener",
        priority: 1000,
        canOpen: (resource) => resource.kind === dashboardExtensionRouteKind,
        open: (resource, openInput) => {
          resolveAvailableRouteResource(resource, projectId);
          ctx.modes.setActiveMode("project");
          setResourceBreadcrumb(ctx, resource);
          if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidebar)) {
            ctx.renderers.setSelectedNode(dashboardWidgetIds.dashboardSidebar, resource.uri);
          }
          return ctx.layout.openWidget(dashboardWidgetIds.extensionRoute, {
            resource,
            title: resource.label,
            replaceActive: openInput.replaceActive,
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
          requestId += 1;
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
