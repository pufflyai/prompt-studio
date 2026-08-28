import type {
  WorkbenchExtensionMetadata as DashboardExtensionMetadata,
  ListExtensionAppearanceResponse,
} from "@pstdio/sdk/api";
import type {
  Disposable,
  LayoutPersistenceAdapter,
  ResourceRef,
  WorkbenchModuleContext,
  WorkbenchModuleContribution,
} from "@pstdio/workbench";
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
  clearCachedDashboardExtensionMetadata,
  emptyDashboardExtensionMetadata,
  setCachedDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { syncActiveResourceContext } from "./active-resource-context";
import { registerDashboardActivityRail } from "./extension-activity-rail";
import { emptyDashboardExtensionAppearance, registerExtensionAppearance } from "./extension-appearance";
import type { ExecuteDashboardExtensionCommand } from "./extension-command-handler";
import {
  captureExtensionContributionRefreshLayout,
  restoreExtensionContributionRefreshLayout,
} from "./extension-contribution-refresh-layout";
import { disposeExtensionContributions, registerExtensionContributions } from "./extension-contribution-registration";
import { reconcileStoredExtensionLayouts, registerExtensionLayoutResetCommands } from "./extension-layout-persistence";
import { reconcileExtensionLayout } from "./extension-layout-reconciliation";
import { refreshExtensionRenderers } from "./extension-module-setup";
import { createExtensionRefreshQueue } from "./extension-refresh-queue";

type LoadDashboardExtensionMetadata = (projectId: string) => Promise<DashboardExtensionMetadata>;
type LoadDashboardExtensionAppearance = (projectId: string) => Promise<ListExtensionAppearanceResponse>;

interface CreateExtensionsModuleInput {
  executeCommand?: ExecuteDashboardExtensionCommand;
  layoutPersistence?: LayoutPersistenceAdapter;
  loadAppearance?: LoadDashboardExtensionAppearance;
  loadMetadata?: LoadDashboardExtensionMetadata;
}

const extensionSyncTables = new Set<CollectionChange["table"]>(["installed_extension_sources", "extension_instances"]);
const extensionContributionModuleId = "dashboard.extensions.contributions";

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

export const createExtensionsModule = (input: CreateExtensionsModuleInput = {}) =>
  ({
    id: "dashboard.extensions",
    activate(ctx: WorkbenchModuleContext) {
      const executeCommand = input.executeCommand ?? executeExtensionCommand;
      const layoutPersistence = input.layoutPersistence;
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
        const previousCompatibility = reconcileStoredExtensionLayouts({
          layoutPersistence,
          metadata: nextResolvedMetadata,
          projectId: nextProjectId,
        });
        setCachedDashboardExtensionMetadata(nextProjectId, nextResolvedMetadata);
        ctx.settings.refresh();
        if (contributionsAreCurrent) {
          primaryResourceBeforeRefresh = undefined;
          setDashboardExtensionsReadyProject(ctx, nextProjectId);
          return;
        }
        const refreshLayout = captureExtensionContributionRefreshLayout(ctx);
        clearContributions();
        try {
          contributionDisposables = [
            ctx.registerChildModule({
              id: extensionContributionModuleId,
              ownerId: "dashboard.extensions",
              source: "extension",
              activate(contributionCtx) {
                return [
                  ...registerExtensionContributions({
                    ctx: contributionCtx,
                    executeCommand,
                    metadata: nextResolvedMetadata,
                    projectId: nextProjectId,
                  }),
                  ...registerExtensionLayoutResetCommands({
                    ctx: contributionCtx,
                    layoutPersistence,
                    metadata: nextResolvedMetadata,
                    projectId: nextProjectId,
                  }),
                ];
              },
            }),
          ];
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[dashboard.extensions] contribution registration failed: ${message}`);
        }
        restoreExtensionContributionRefreshLayout(ctx, {
          ...refreshLayout,
          layout: reconcileExtensionLayout({
            layout: refreshLayout.layout,
            metadata: nextResolvedMetadata,
            previousCompatibility,
          }),
        });
        if (ctx.renderers.getTreeRenderer(dashboardWidgetIds.dashboardSidenav)) {
          ctx.renderers.refresh(dashboardWidgetIds.dashboardSidenav);
        }
        activityRail.sync();
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

      const activityRail = registerDashboardActivityRail(ctx, () => metadata);
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
        refreshExtensionRenderers(ctx, metadata);
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
          activityRail.dispose();
          unsubscribeProject();
          unsubscribeSync();
        },
      };
    },
  }) satisfies WorkbenchModuleContribution;
