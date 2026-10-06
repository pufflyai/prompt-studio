import type {
  WorkbenchExtensionMetadata as DashboardExtensionMetadata,
  ListExtensionAppearanceResponse,
} from "@pstdio/sdk/api";
import type { PageLocation } from "@pstdio/sdk/extensions";
import {
  batchWorkbenchChanges,
  type Disposable,
  type WorkbenchModuleContext,
  type WorkbenchModuleContribution,
} from "@pstdio/workbench";
import { logExtensionHostDiagnostic } from "pstdio-extensions/bridge/host";
import i18n from "@/i18n";
import { type CollectionChange, subscribeCollections } from "@/lib/sync/collections";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import {
  executeExtensionCommand,
  getProjectExtensionAppearance,
  getProjectExtensionMetadata,
} from "@/shared/extensions/api";
import { subscribeCoreViewDataEvents } from "@/shared/extensions/core-view-data-events";
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
import { omitExtensionMetadata, registerHealthyExtensions } from "./extension-contribution-isolation";
import {
  captureExtensionContributionRefreshLayout,
  restoreExtensionContributionRefreshLayout,
} from "./extension-contribution-refresh-layout";
import {
  disposeExtensionContributions,
  notifyUnresolvedExtensionMenus,
  registerExtensionContributions,
} from "./extension-contribution-registration";
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

      const registrationError = (projectId: string, error: unknown, extensionId?: string) =>
        logExtensionHostDiagnostic({
          event: "registration-error",
          projectId,
          extensionId,
          message: error instanceof Error ? error.message : String(error),
        });

      // Returns what is registered now; a failed extension is left out so the next refresh retries it.
      const replaceContributions = (nextProjectId: string, nextMetadata: ResolvedWorkbenchExtensionMetadata) => {
        clearContributions();
        try {
          const registration = registerHealthyExtensions({
            metadata: nextMetadata,
            register: (metadata) =>
              ctx.registerChildModule({
                id: extensionContributionModuleId,
                ownerId: "dashboard.extensions",
                source: "extension",
                activate: (contributionCtx) =>
                  registerExtensionContributions({
                    ctx: contributionCtx,
                    executeCommand,
                    metadata,
                    projectId: nextProjectId,
                  }),
              }),
            onFailure: (extensionId, error) => registrationError(nextProjectId, error, extensionId),
          });
          contributionDisposables = [registration.disposable];
          return registration.metadata;
        } catch (error) {
          registrationError(nextProjectId, error);
          return omitExtensionMetadata(nextMetadata, new Set(nextMetadata.extensions.map((extension) => extension.id)));
        }
      };

      const commitMetadata = (nextProjectId: string, registeredMetadata: ResolvedWorkbenchExtensionMetadata) => {
        metadata = registeredMetadata;
        setCachedDashboardExtensionMetadata(nextProjectId, registeredMetadata);
        ctx.context.set(dashboardEditableTemplatesContextKey, hasEditableTemplateAssets(registeredMetadata));
        ctx.settings.refresh();
      };

      const applyMetadata = (nextProjectId: string, nextMetadata: DashboardExtensionMetadata) => {
        const nextResolvedMetadata = localizeExtensionMetadata(nextMetadata);
        rawMetadata = nextMetadata;
        // `metadata` holds only what registered, so a refresh after a failure always retries.
        if (hasSameSerializedMetadata(metadata, nextResolvedMetadata)) {
          commitMetadata(nextProjectId, nextResolvedMetadata);
          setDashboardExtensionsReadyProject(ctx, nextProjectId);
          return;
        }
        const pageLocationBeforeRefresh = displacedPageLocation ?? ctx.pages.store.getState().location;
        const refreshLayout = captureExtensionContributionRefreshLayout(ctx);
        // Observers must see the completed refresh. A temporary missing page can
        // otherwise restore Start's terminal and mistake its removal for a close.
        batchWorkbenchChanges(() => {
          commitMetadata(nextProjectId, replaceContributions(nextProjectId, nextResolvedMetadata));
          restoreExtensionContributionRefreshLayout(ctx, refreshLayout);
          if (pageLocationBeforeRefresh) {
            const replay = ctx.pageLocations.replay(pageLocationBeforeRefresh);
            displacedPageLocation = replay.ok ? undefined : pageLocationBeforeRefresh;
          }
        });
        notifyUnresolvedExtensionMenus(ctx, metadata ?? nextResolvedMetadata);
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
      const unsubscribeViewData = subscribeCoreViewDataEvents();
      const unsubscribeSync = subscribeCollections((change) => {
        if (!change) return;
        if (extensionSyncTables.has(change.table)) {
          refreshProject();
          return;
        }
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
          unsubscribeViewData();
        },
      };
    },
  }) satisfies WorkbenchModuleContribution;
