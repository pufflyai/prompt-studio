import type {
  WorkbenchExtensionMetadata as DashboardExtensionMetadata,
  ListExtensionAppearanceResponse,
} from "@pstdio/sdk/api";
import { type PageLocation, viewDataEvents } from "@pstdio/sdk/extensions";
import {
  batchWorkbenchChanges,
  type Disposable,
  type WorkbenchModuleContext,
  type WorkbenchModuleContribution,
} from "@pstdio/workbench";
import {
  createWorkbenchExtensionChatRendererOwners,
  createWorkbenchExtensionTerminalRendererOwners,
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
  getExtensionPresentationLocale,
  localizeExtensionMetadata,
  type ResolvedWorkbenchExtensionMetadata,
  registerExtensionTranslationBundles,
} from "@/shared/extensions/extension-localization";
import { acceptExtensionPresentationTranslations } from "@/shared/extensions/extension-presentation-translations";
import {
  clearDashboardExtensionsReadyProject,
  clearDashboardExtensionsRegisteredProject,
  setDashboardExtensionsReadyProject,
  setDashboardExtensionsRegisteredProject,
} from "@/shared/extensions/extension-readiness";
import { publishExtensionEvent } from "@/shared/extensions/extension-webview-broadcast";
import { invalidateExtensionAuxiliaryQueries } from "@/shared/extensions/project-extension-cache";
import { observeProjectResourceRemovals } from "@/shared/extensions/resource-removal-feed";
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
import {
  captureExtensionContributionRefreshLayout,
  restoreExtensionContributionRefreshLayout,
} from "./extension-contribution-refresh-layout";
import { notifyUnresolvedExtensionMenus } from "./extension-contribution-registration";
import { createExtensionContributionReplacement } from "./extension-contribution-replacement";
import { type CreateExtensionsModuleInput, createExtensionModuleCatalog } from "./extension-module-catalog";
import { createExtensionQueryObservation } from "./extension-query-observation";
import { createExtensionSettingsRetirement } from "./extension-settings-authority";
import { registerExtensionsPage } from "./extensions-page";

const extensionSyncTables = new Set<CollectionChange["table"]>(["installed_extension_sources", "extension_instances"]);

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

const registrationError = (projectId: string, error: unknown, extensionId?: string) =>
  logExtensionHostDiagnostic({
    event: "registration-error",
    projectId,
    extensionId,
    message: error instanceof Error ? error.message : String(error),
  });

interface CatalogObservation {
  clear(): void;
  resume(projectId: string): void;
}
const observeCatalogActivation = (
  ctx: WorkbenchModuleContext,
  projectId: () => string | undefined,
  metadataRefresh: CatalogObservation,
  appearanceRefresh: CatalogObservation,
) => {
  return ctx.activation.store.subscribe((next, previous) => {
    if (next.active === previous.active) return;
    if (!next.active) {
      metadataRefresh.clear();
      appearanceRefresh.clear();
    } else if (projectId()) {
      appearanceRefresh.resume(projectId()!);
      metadataRefresh.resume(projectId()!);
    }
  });
};

export const createExtensionsModule = (input: CreateExtensionsModuleInput = {}) =>
  ({
    id: "dashboard.extensions",
    activate(ctx: WorkbenchModuleContext) {
      registerExtensionsPage(ctx);
      const owner = getRuntimeCollections();
      const executeCommand = input.executeCommand ?? executeExtensionCommand;
      const sharedQueries = getDashboardScopedQueries(owner);
      const catalog = createExtensionModuleCatalog(input, input.queries ?? sharedQueries, owner);
      let projectId = getDashboardSelectedProjectId(ctx);
      let metadata: ResolvedWorkbenchExtensionMetadata | undefined;
      let registeredLocale: string | undefined;
      let appearanceDisposable: ReturnType<typeof registerExtensionAppearance> | undefined;
      let translationDisposable: Disposable | undefined;
      const chatRendererOwners = createWorkbenchExtensionChatRendererOwners();
      const terminalRendererOwners = createWorkbenchExtensionTerminalRendererOwners();
      let displacedPageLocation: PageLocation | undefined;
      let retiredSettings: ReturnType<typeof createExtensionSettingsRetirement> | undefined;

      const clearContributions = (preserveChatOwners = false) => {
        replaceContributions.dispose();
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

      const applyAppearance = (nextProjectId: string, nextAppearance: ListExtensionAppearanceResponse) => {
        clearTranslations();
        translationDisposable = registerExtensionTranslationBundles(nextAppearance, owner, nextProjectId);
        const preferences = resolveExtensionAppearancePreferences(nextAppearance, owner, nextProjectId);
        // Theme sources can move between projects while their resolved visuals stay
        // identical. Retain that catalog so every theme consumer need not rerender.
        batchWorkbenchChanges(() => {
          if (appearanceDisposable) appearanceDisposable.update(preferences);
          else appearanceDisposable = registerExtensionAppearance(ctx, preferences);
        });
        for (const extensionId of acceptExtensionPresentationTranslations(
          catalog.query(nextProjectId).appearance,
          nextAppearance,
        )) {
          publishExtensionEvent(
            { id: viewDataEvents.extensionTranslationsChanged.id, projectId: nextProjectId, extensionId },
            owner,
          );
        }
      };

      const replaceContributions = createExtensionContributionReplacement({
        owner,
        ctx,
        chatRendererOwners,
        terminalRendererOwners,
        executeCommand,
        registrationError,
      });

      const commitMetadata = (nextProjectId: string, registeredMetadata: ResolvedWorkbenchExtensionMetadata) => {
        metadata = registeredMetadata;
        registeredLocale = getExtensionPresentationLocale();
        setCachedDashboardExtensionMetadata(nextProjectId, registeredMetadata, owner);
        ctx.context.set(dashboardEditableTemplatesContextKey, hasEditableTemplateAssets(registeredMetadata));
        ctx.settings.refresh();
        setDashboardExtensionsRegisteredProject(ctx, nextProjectId);
      };

      const applyMetadata = (nextProjectId: string, nextMetadata: DashboardExtensionMetadata) => {
        const nextResolvedMetadata = localizeExtensionMetadata(nextMetadata, owner, nextProjectId);
        // `metadata` holds only what registered, so a refresh after a failure always retries.
        if (
          registeredLocale === getExtensionPresentationLocale() &&
          hasSameSerializedMetadata(metadata, nextResolvedMetadata)
        )
          return;
        const pageLocationBeforeRefresh = displacedPageLocation ?? ctx.pages.store.getState().location;
        const refreshLayout = captureExtensionContributionRefreshLayout(ctx);
        // Observers must see the completed refresh. A temporary missing page can
        // otherwise restore Start's terminal and mistake its removal for a close.
        batchWorkbenchChanges(() => {
          const refreshed = replaceContributions.replace(
            nextProjectId,
            nextResolvedMetadata,
            getExtensionPresentationLocale(),
            catalog.query(nextProjectId).metadata,
          );
          commitMetadata(nextProjectId, refreshed.metadata);
          if (refreshed.displaced) restoreExtensionContributionRefreshLayout(ctx, refreshLayout);
          const completedSettings = retiredSettings;
          retiredSettings = undefined;
          completedSettings?.complete();
          if (pageLocationBeforeRefresh && (refreshed.displaced || displacedPageLocation)) {
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
        isAvailable: () =>
          ctx.activation.isActive() && !owner.isDisposed() && !(input.queries ?? sharedQueries).isDisposed(),
        apply: applyMetadata,
        onComplete: (id) => setDashboardExtensionsReadyProject(ctx, id),
        onPending: () => clearDashboardExtensionsReadyProject(ctx),
        onRetire: (id) => {
          metadata = undefined;
          registeredLocale = undefined;
          retiredSettings ??= createExtensionSettingsRetirement(ctx);
          retiredSettings.retire(() => {
            clearContributions();
            clearTranslations();
            clearCachedDashboardExtensionMetadata(id, owner);
            clearDashboardExtensionsRegisteredProject(ctx);
          });
        },
        fallback: () => emptyDashboardExtensionMetadata,
        query: (id) => catalog.query(id).metadata,
      });
      const appearanceRefresh = createExtensionQueryObservation<ListExtensionAppearanceResponse>({
        isAvailable: () =>
          ctx.activation.isActive() && !owner.isDisposed() && !(input.queries ?? sharedQueries).isDisposed(),
        apply: (nextProjectId, nextAppearance) => {
          if (!nextAppearance) return;
          applyAppearance(nextProjectId, nextAppearance);
          const rawMetadata = metadataRefresh.value();
          if (rawMetadata) applyMetadata(nextProjectId, rawMetadata);
        },
        fallback: () => undefined,
        query: (id) => catalog.query(id).appearance,
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
          retiredSettings?.dispose();
          retiredSettings = undefined;
          metadataRefresh.clear();
          appearanceRefresh.clear();
          metadata = undefined;
          registeredLocale = undefined;
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
        if (!projectId || !rawMetadata) return;
        if (rawAppearance) applyAppearance(projectId, rawAppearance);
        applyMetadata(projectId, rawMetadata);
      };

      const activityRail = registerDashboardActivityRail(ctx, () => metadata);
      const activeResourceContext = syncActiveResourceContext(ctx);

      refreshProject();
      const unsubscribeActivation = observeCatalogActivation(ctx, () => projectId, metadataRefresh, appearanceRefresh);
      i18n.on("languageChanged", reapplyLocale);
      const unsubscribeProject = subscribeDashboardSelectedProject(ctx, refreshProject);
      const unsubscribeViewData = subscribeCoreViewDataEvents();
      const unsubscribeResourceData = subscribeResourceViewDataEvents({
        projectId: () => projectId,
        refreshEventIds: () =>
          ctx.commandPaletteResources.listProviders().flatMap((provider) => provider.refreshEventIds ?? []),
      });
      const unsubscribeResourceRemoval = observeProjectResourceRemovals(ctx.resources, () => projectId, owner);
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
          retiredSettings?.dispose();
          retiredSettings = undefined;
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
          unsubscribeActivation();
          unsubscribeSync();
          unsubscribeViewData();
          unsubscribeResourceData();
          unsubscribeResourceRemoval();
          catalog.dispose();
        },
      };
    },
  }) satisfies WorkbenchModuleContribution;
