import type {
  WorkbenchExtensionMetadata as DashboardExtensionMetadata,
  ListExtensionAppearanceResponse,
} from "@pstdio/sdk/api";
import type { PageLocation } from "@pstdio/sdk/extensions";
import type { Disposable, WorkbenchModuleContext, WorkbenchModuleContribution } from "@pstdio/workbench";
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
  dashboardEditableTemplatesContextKey,
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
import { refreshExtensionRenderers } from "./extension-module-setup";
import { createExtensionRefreshQueue } from "./extension-refresh-queue";

type LoadDashboardExtensionMetadata = (projectId: string) => Promise<DashboardExtensionMetadata>;
type LoadDashboardExtensionAppearance = (projectId: string) => Promise<ListExtensionAppearanceResponse>;

interface CreateExtensionsModuleInput {
  executeCommand?: ExecuteDashboardExtensionCommand;
  loadAppearance?: LoadDashboardExtensionAppearance;
  loadMetadata?: LoadDashboardExtensionMetadata;
}

const extensionSyncTables = new Set<CollectionChange["table"]>(["installed_extension_sources", "extension_instances"]);
const extensionContributionModuleId = "dashboard.extensions.contributions";

const hasSameSerializedMetadata = (
  current: ResolvedWorkbenchExtensionMetadata | undefined,
  next: ResolvedWorkbenchExtensionMetadata,
) => Boolean(current && JSON.stringify(current) === JSON.stringify(next));

const hasEditableTemplateAssets = (metadata: ResolvedWorkbenchExtensionMetadata) => {
  const providerExtensionIds = new Set(
    (metadata.templateTypes ?? []).filter((type) => Boolean(type.commands)).map((type) => type.extensionId),
  );
  return (metadata.templates ?? []).some((template) => providerExtensionIds.has(template.extensionId));
};

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
      let displacedPageLocation: PageLocation | undefined;

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

      const replaceContributions = (nextProjectId: string, nextMetadata: ResolvedWorkbenchExtensionMetadata) => {
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
                    metadata: nextMetadata,
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
      };

      const applyMetadata = (nextProjectId: string, nextMetadata: DashboardExtensionMetadata) => {
        const nextResolvedMetadata = localizeExtensionMetadata(nextMetadata);
        const contributionsAreCurrent = hasSameSerializedMetadata(metadata, nextResolvedMetadata);
        const pageLocationBeforeRefresh = displacedPageLocation ?? ctx.pages.store.getState().location;

        rawMetadata = nextMetadata;
        metadata = nextResolvedMetadata;
        setCachedDashboardExtensionMetadata(nextProjectId, nextResolvedMetadata);
        ctx.context.set(dashboardEditableTemplatesContextKey, hasEditableTemplateAssets(nextResolvedMetadata));
        ctx.settings.refresh();
        if (contributionsAreCurrent) {
          setDashboardExtensionsReadyProject(ctx, nextProjectId);
          return;
        }
        const refreshLayout = captureExtensionContributionRefreshLayout(ctx);
        replaceContributions(nextProjectId, nextResolvedMetadata);
        restoreExtensionContributionRefreshLayout(ctx, refreshLayout);
        if (pageLocationBeforeRefresh) {
          const replay = ctx.pageLocations.replay(pageLocationBeforeRefresh);
          displacedPageLocation = replay.ok ? undefined : pageLocationBeforeRefresh;
        }
        if (ctx.views.getView(dashboardWidgetIds.dashboardSidenav)) {
          ctx.views.refreshView(dashboardWidgetIds.dashboardSidenav);
        }
        activityRail.sync();
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
          displacedPageLocation = undefined;
          clearCachedDashboardExtensionMetadata(previousProjectId);
          clearCachedDashboardExtensionMetadata(projectId);
          ctx.context.delete(dashboardEditableTemplatesContextKey);
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
          ctx.context.delete(dashboardEditableTemplatesContextKey);
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
