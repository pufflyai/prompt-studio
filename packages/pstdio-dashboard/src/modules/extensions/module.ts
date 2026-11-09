import type {
  WorkbenchExtensionMetadata as DashboardExtensionMetadata,
  ListExtensionAppearanceResponse,
} from "@pstdio/sdk/api";
import type { PageLocation, ScopedQueryClient } from "@pstdio/sdk/extensions";
import {
  batchWorkbenchChanges,
  type Disposable,
  type WorkbenchModuleContext,
  type WorkbenchModuleContribution,
} from "@pstdio/workbench";
import {
  createWorkbenchExtensionChatRendererOwners,
  createWorkbenchExtensionTerminalRendererOwners,
  reconcileBridgeWebviewHostEventPublishers,
} from "@pstdio/workbench/extensions";
import { logExtensionHostDiagnostic } from "pstdio-extensions/bridge/host";
import i18n from "@/i18n";
import { catalogChangeScopes } from "@/lib/extension-catalog-events";
import { getDashboardQueryClient } from "@/lib/query-client";
import { getDashboardScopedQueries } from "@/lib/scoped-queries";
import { type CollectionChange, getRuntimeCollections, subscribeCollections } from "@/lib/sync/collections";
import { getDashboardSelectedProjectId, subscribeDashboardSelectedProject } from "@/shared/app/project-context";
import { dashboardWidgetIds } from "@/shared/app/widget-ids";
import { executeExtensionCommand } from "@/shared/extensions/api";
import { subscribeCoreViewDataEvents } from "@/shared/extensions/core-view-data-events";
import {
  localizeExtensionMetadata,
  type ResolvedWorkbenchExtensionMetadata,
  registerExtensionTranslationBundles,
} from "@/shared/extensions/extension-localization";
import {
  clearDashboardExtensionsReadyProject,
  clearDashboardExtensionsRegisteredProject,
  setDashboardExtensionsReadyProject,
  setDashboardExtensionsRegisteredProject,
} from "@/shared/extensions/extension-readiness";
import { invalidateExtensionAuxiliaryQueries } from "@/shared/extensions/project-extension-cache";
import { getProjectExtensionQueries } from "@/shared/extensions/project-extension-queries";
import { subscribeResourceViewDataEvents } from "@/shared/extensions/resource-view-data-events";
import {
  clearCachedDashboardExtensionMetadata,
  dashboardEditableTemplatesContextKey,
  emptyDashboardExtensionMetadata,
  setCachedDashboardExtensionMetadata,
} from "@/shared/extensions/workbench-extension-contributions";
import { syncActiveResourceContext } from "./active-resource-context";
import { registerDashboardActivityRail } from "./extension-activity-rail";
import { registerExtensionAppearance, resolveExtensionAppearancePreferences } from "./extension-appearance";
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
import { createExtensionQueryObservation } from "./extension-query-observation";
import { registerExtensionsPage } from "./extensions-page";

type LoadDashboardExtensionMetadata = (projectId: string) => Promise<DashboardExtensionMetadata>;
type LoadDashboardExtensionAppearance = (projectId: string) => Promise<ListExtensionAppearanceResponse>;

interface CreateExtensionsModuleInput {
  queries?: ScopedQueryClient;
  executeCommand?: ExecuteDashboardExtensionCommand;
  loadAppearance?: LoadDashboardExtensionAppearance;
  loadMetadata?: LoadDashboardExtensionMetadata;
}

const extensionSyncTables = new Set<CollectionChange["table"]>(["installed_extension_sources", "extension_instances"]);
const extensionContributionModuleId = "dashboard.extensions.contributions";

const hasSameSerializedMetadata = (
  current: ResolvedWorkbenchExtensionMetadata | undefined,
  next: ResolvedWorkbenchExtensionMetadata,
) => current === next || Boolean(current && JSON.stringify(current) === JSON.stringify(next));

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
      registerExtensionsPage(ctx);
      const owner = getRuntimeCollections();
      const executeCommand = input.executeCommand ?? executeExtensionCommand;
      const sharedQueries = getDashboardScopedQueries(owner);
      const namespace = input.loadMetadata || input.loadAppearance ? crypto.randomUUID() : undefined;
      const customReads = new Set<import("@pstdio/sdk/extensions").ScopedQuery<unknown>>();
      const catalog = (projectId: string) => {
        const result = getProjectExtensionQueries(projectId, {
          ...input,
          owner,
          namespace,
          queries: input.queries ?? sharedQueries,
        });
        if (namespace) {
          customReads.add(result.metadata);
          customReads.add(result.appearance);
          for (const query of customReads) if (query.isDisposed()) customReads.delete(query);
        }
        return result;
      };
      let projectId = getDashboardSelectedProjectId(ctx);
      let metadata: ResolvedWorkbenchExtensionMetadata | undefined;
      let appearanceDisposable: ReturnType<typeof registerExtensionAppearance> | undefined;
      let translationDisposable: Disposable | undefined;
      let contributionDisposables: Disposable[] = [];
      const chatRendererOwners = createWorkbenchExtensionChatRendererOwners();
      const terminalRendererOwners = createWorkbenchExtensionTerminalRendererOwners();
      let displacedPageLocation: PageLocation | undefined;

      const clearContributions = (preserveChatOwners = false) => {
        disposeExtensionContributions(contributionDisposables);
        contributionDisposables = [];
        if (!preserveChatOwners) {
          chatRendererOwners.dispose();
        }
      };

      const clearTranslations = () => {
        translationDisposable?.dispose();
        translationDisposable = undefined;
      };

      const clearAppearance = () => {
        clearTranslations();
        appearanceDisposable?.dispose();
        appearanceDisposable = undefined;
      };

      const applyAppearance = (nextAppearance: ListExtensionAppearanceResponse) => {
        clearTranslations();
        translationDisposable = registerExtensionTranslationBundles(nextAppearance, owner);
        const preferences = resolveExtensionAppearancePreferences(nextAppearance, owner);
        // Theme sources can move between projects while their resolved visuals stay
        // identical. Retain that catalog so every theme consumer need not rerender.
        batchWorkbenchChanges(() => {
          if (appearanceDisposable) appearanceDisposable.update(preferences);
          else appearanceDisposable = registerExtensionAppearance(ctx, preferences);
        });
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
        chatRendererOwners.reconcile(nextProjectId, nextMetadata);
        terminalRendererOwners.reconcile(nextProjectId, nextMetadata);
        clearContributions(true);
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
                    chatRendererOwners,
                    terminalRendererOwners,
                    executeCommand,
                    metadata,
                    projectId: nextProjectId,
                  }),
              }),
            onFailure: (extensionId, error) => registrationError(nextProjectId, error, extensionId),
          });
          contributionDisposables = [registration.disposable];
          chatRendererOwners.reconcile(nextProjectId, registration.metadata);
          terminalRendererOwners.reconcile(nextProjectId, registration.metadata);
          reconcileBridgeWebviewHostEventPublishers(
            ctx,
            nextProjectId,
            new Set(registration.metadata.views.filter((view) => view.body.kind === "webview").map((view) => view.id)),
          );
          return registration.metadata;
        } catch (error) {
          registrationError(nextProjectId, error);
          chatRendererOwners.dispose();
          terminalRendererOwners.reconcile(nextProjectId, emptyDashboardExtensionMetadata);
          reconcileBridgeWebviewHostEventPublishers(ctx, nextProjectId, new Set());
          return omitExtensionMetadata(nextMetadata, new Set(nextMetadata.extensions.map((extension) => extension.id)));
        }
      };

      const commitMetadata = (nextProjectId: string, registeredMetadata: ResolvedWorkbenchExtensionMetadata) => {
        metadata = registeredMetadata;
        setCachedDashboardExtensionMetadata(nextProjectId, registeredMetadata, owner);
        ctx.context.set(dashboardEditableTemplatesContextKey, hasEditableTemplateAssets(registeredMetadata));
        ctx.settings.refresh();
        setDashboardExtensionsRegisteredProject(ctx, nextProjectId);
      };

      const applyMetadata = (nextProjectId: string, nextMetadata: DashboardExtensionMetadata) => {
        const nextResolvedMetadata = localizeExtensionMetadata(nextMetadata, owner);
        // `metadata` holds only what registered, so a refresh after a failure always retries.
        if (hasSameSerializedMetadata(metadata, nextResolvedMetadata)) return;
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
      };

      const metadataRefresh = createExtensionQueryObservation({
        isAvailable: () => !owner.isDisposed() && !(input.queries ?? sharedQueries).isDisposed(),
        apply: applyMetadata,
        onComplete: (id) => setDashboardExtensionsReadyProject(ctx, id),
        onPending: () => clearDashboardExtensionsReadyProject(ctx),
        onRetire: (id) => {
          metadata = undefined;
          clearContributions();
          clearTranslations();
          clearCachedDashboardExtensionMetadata(id, owner);
          clearDashboardExtensionsRegisteredProject(ctx);
        },
        fallback: () => emptyDashboardExtensionMetadata,
        query: (id) => catalog(id).metadata,
      });
      const appearanceRefresh = createExtensionQueryObservation<ListExtensionAppearanceResponse>({
        isAvailable: () => !owner.isDisposed() && !(input.queries ?? sharedQueries).isDisposed(),
        apply: (nextProjectId, nextAppearance) => {
          if (!nextAppearance) return;
          applyAppearance(nextAppearance);
          const rawMetadata = metadataRefresh.value();
          if (rawMetadata) applyMetadata(nextProjectId, rawMetadata);
        },
        fallback: () => undefined,
        query: (id) => catalog(id).appearance,
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
          metadataRefresh.clear();
          appearanceRefresh.clear();
          metadata = undefined;
          displacedPageLocation = undefined;
          clearCachedDashboardExtensionMetadata(previousProjectId, owner);
          clearCachedDashboardExtensionMetadata(projectId, owner);
          ctx.context.delete(dashboardEditableTemplatesContextKey);
          clearDashboardExtensionsReadyProject(ctx);
          clearDashboardExtensionsRegisteredProject(ctx);
          clearContributions(true);
          // Labels belong to this project; resolved visual themes can survive its loading gap.
          clearTranslations();
          // Appearance stays live until the destination catalog settles. Unlike tools,
          // colors carry no project actions and must not flash a default while loading.
        }

        if (!projectId) return;
        // Keep existing tools live, but do not treat pending or superseded metadata as setup eligibility.
        clearDashboardExtensionsReadyProject(ctx);
        metadataRefresh.refresh(projectId);
        appearanceRefresh.refresh(projectId);
      };

      const reapplyLocale = () => {
        const rawMetadata = metadataRefresh.value();
        const rawAppearance = appearanceRefresh.value();
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
      const unsubscribeResourceData = subscribeResourceViewDataEvents({
        projectId: () => projectId,
        refreshEventIds: () =>
          ctx.commandPaletteResources.listProviders().flatMap((provider) => provider.refreshEventIds ?? []),
      });
      const unsubscribeSync = subscribeCollections((change) => {
        if (!change) return;
        if (extensionSyncTables.has(change.table)) {
          const scopes = catalogChangeScopes(change);
          if (!scopes.has(undefined) && !scopes.has(projectId)) return;
          void invalidateExtensionAuxiliaryQueries(getDashboardQueryClient(owner), projectId);
        }
      });

      return {
        dispose() {
          metadataRefresh.clear();
          appearanceRefresh.clear();
          activeResourceContext.dispose();
          clearCachedDashboardExtensionMetadata(projectId, owner);
          ctx.context.delete(dashboardEditableTemplatesContextKey);
          clearDashboardExtensionsReadyProject(ctx);
          clearDashboardExtensionsRegisteredProject(ctx);
          clearContributions();
          terminalRendererOwners.dispose();
          clearAppearance();
          i18n.off("languageChanged", reapplyLocale);
          activityRail.dispose();
          unsubscribeProject();
          unsubscribeSync();
          unsubscribeViewData();
          unsubscribeResourceData();
          for (const query of customReads) query.dispose();
          customReads.clear();
        },
      };
    },
  }) satisfies WorkbenchModuleContribution;
