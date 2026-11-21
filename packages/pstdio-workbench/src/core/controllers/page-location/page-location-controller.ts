import type { NavigationTargetPage, PageLocation } from "@pstdio/sdk/extensions";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { createWorkbenchEvent } from "../../shared/workbench-event";
import { eligibleDefaultPage } from "./default-page";
import { createPageHistoryReplay } from "./page-history-replay";
import { createPageLocationControllerActions } from "./page-location-actions";
import {
  createPageHistoryEntry,
  createPageLocationFailureHandler,
  createPageLocationHistory,
} from "./page-location-history-entry";
import {
  normalizeWorkbenchPageLocation,
  normalizeWorkbenchPageTarget,
  workbenchPageLocationsEqual,
} from "./page-location-normalization";
import { setPageLocationPreparation } from "./page-location-preparation";
import {
  createMainViewSelector,
  createPageLocationPreparer,
  createPageLocationPublisher,
  createPageLocationReplayer,
  createPageParamsUpdater,
  createPreparedPageLocationPublisher,
} from "./page-location-publish";
import { resolveBootLocation, restoreRememberedLocation } from "./page-location-restoration";
import { createRootLevelLocationTracker } from "./page-location-root-level";
import type {
  CreateWorkbenchPageLocationControllerInput,
  ResolvedPageLocation,
  WorkbenchPageLocationController,
  WorkbenchPageNavigationResult,
} from "./page-location-types";
import {
  clearMissingPage,
  createUnavailablePagePublisher,
  prepareUnavailablePage,
  replayUnavailablePage,
  restoredUnavailableMode,
} from "./page-location-unavailable";
import { createPageNavigationMemory } from "./page-navigation-memory";
import { connectPageOwnerRemoval } from "./page-owner-removal";
import { createPagePlacementCloser } from "./page-placement-closer";
import { createPageResourceRemover } from "./page-resource-remover";
import { createPageUrlResolver, isExplicitPageUrl, isPageHistoryState } from "./page-url-resolver";

export type {
  CreateWorkbenchPageLocationControllerInput,
  PersistedWorkbenchPageLocation,
  WorkbenchPageBrowserEntry,
  WorkbenchPageHistoryState,
  WorkbenchPageLocationBrowser,
  WorkbenchPageLocationController,
  WorkbenchPageLocationDiagnostic,
  WorkbenchPageLocationHistoryState,
  WorkbenchPageLocationPersistence,
  WorkbenchPageNavigationResult,
} from "./page-location-types";

const normalizeTarget = <Value>(
  input: CreateWorkbenchPageLocationControllerInput<Value>,
  memory: ReturnType<typeof createPageNavigationMemory>,
  target: NavigationTargetPage,
): ResolvedPageLocation => {
  const pages = input.registry.listPages;
  const resources = getWorkbenchPageRegistryInternals(input.registry).resources;
  const resolved = normalizeWorkbenchPageTarget({
    target,
    pages: pages(),
    resources,
    active: input.registry.store.getState().location,
  });
  if (target.intent !== "restore") return resolved;
  return restoreRememberedLocation(
    resolved,
    memory.find(resolved.location),
    (location) => normalizeWorkbenchPageLocation({ location, pages: pages(), resources }),
    (location) => input.restoreLocation?.(location, input.registry.store.getState().projectId!) ?? location,
  );
};

const defaultPageLocation = <Value>(input: CreateWorkbenchPageLocationControllerInput<Value>) => {
  const page = eligibleDefaultPage(input);
  if (!page) throw new Error("The configured default page is unavailable");
  return normalizeWorkbenchPageTarget({
    target: { kind: "page", page: page.ref },
    pages: input.registry.listPages(),
    resources: getWorkbenchPageRegistryInternals(input.registry).resources,
  });
};

export const createWorkbenchPageLocationController = <Value>(
  input: CreateWorkbenchPageLocationControllerInput<Value>,
): WorkbenchPageLocationController => {
  const navigation = createWorkbenchEvent<PageLocation>("page navigation subscriber");
  const internals = getWorkbenchPageRegistryInternals(input.registry);
  const pages = input.registry.listPages;
  const resources = internals.resources;
  const memory = createPageNavigationMemory({ pages, resources });
  const history = createPageLocationHistory();

  const fail = createPageLocationFailureHandler(input.reportDiagnostic);
  const historyEntry = createPageHistoryEntry({
    pages,
    resources,
    removalVersion: input.getResourceRemovalVersion,
    removalEpoch: input.getResourceRemovalEpoch,
  });

  const rootLevel = createRootLevelLocationTracker({
    levels: input,
    pages,
    normalize: (location) => normalizeStored(location),
    resourceKey: (resource) => resources.toUri(resources.normalize(resource)),
    start: () => start(),
  });

  const publish = createPageLocationPublisher(input, internals, {
    getIndex: history.getIndex,
    commitIndex: history.commitIndex,
    entry: historyEntry,
    publish: history.publish,
    rememberRootLevel: rootLevel.remember,
    rememberLocation: memory.remember,
  });
  const publishUnavailable = createUnavailablePagePublisher(input, history, historyEntry);
  const prepareState = createPageLocationPreparer(input.registry);
  const commit = (
    projectId: string,
    resolved: ResolvedPageLocation,
    history: "push" | "replace" | "none",
    action: string,
  ) =>
    publish(projectId, prepareState.open(projectId, resolved, action), history, action, () =>
      memory.consume(resolved.consumeRemembered),
    );

  const normalizeStored = (location: PageLocation): ResolvedPageLocation =>
    normalizeWorkbenchPageLocation({ location, pages: pages(), resources });
  const restoreResolved = (resolved: ResolvedPageLocation, projectId: string, removalVersion?: number) =>
    restoreRememberedLocation(
      resolved,
      resolved.location,
      normalizeStored,
      (location) => input.restoreLocation?.(location, projectId, removalVersion) ?? location,
    );

  const start = () => defaultPageLocation(input);

  const missingPage = (projectId: string | undefined, operation: "push" | "replace" | "none", modeId?: string) =>
    clearMissingPage(input, history, historyEntry, projectId, operation, modeId);

  const resolveUrl = createPageUrlResolver({
    pages,
    resources,
    normalize: normalizeStored,
    root: start,
  });

  const restore = (
    projectId: string,
    source: "boot" | "project-switch",
    useCurrentUrl: boolean,
    selectedModeId?: string,
  ): WorkbenchPageNavigationResult => {
    try {
      const browserEntry = input.browser.current();
      if (isPageHistoryState(browserEntry.state) && browserEntry.state.projectId === projectId)
        history.adopt(browserEntry.state.index);
      else history.reset();
      const hasProjectUrl = useCurrentUrl && isExplicitPageUrl(browserEntry.url, projectId);
      const fromUrl = hasProjectUrl ? resolveUrl(projectId, browserEntry) : undefined;
      if (hasProjectUrl && !fromUrl) throw new Error(`Cannot resolve page URL: ${browserEntry.url}`);
      // A URL wins over the saved location, but the saved root level still names the way out of a level.
      const persisted = input.persistence.load(projectId);
      memory.load(projectId, persisted?.remembered);
      rootLevel.restore(persisted?.rootLevel);
      const unavailableMode = restoredUnavailableMode(input, persisted, hasProjectUrl);
      if (unavailableMode) {
        publishUnavailable(prepareUnavailablePage(input, projectId, unavailableMode), () => {}, "replace");
        return fail(source, new Error("The Main page is unavailable"));
      }
      const saved = hasProjectUrl ? undefined : persisted?.location;
      const resolved = restoreResolved(resolveBootLocation(fromUrl, saved, normalizeStored, start), projectId);
      const action = source === "boot" ? "bootPageLocation" : "switchPageProject";
      const matchesSavedLocation = workbenchPageLocationsEqual(
        persisted?.location,
        resolved.location,
        resources,
        pages(),
      );
      const prepare = matchesSavedLocation ? prepareState.restore : prepareState.open;
      const state = prepare(projectId, resolved, action);
      const commitRestoration = () => {
        try {
          return publish(projectId, state, "replace", action, () => memory.consume(resolved.consumeRemembered));
        } catch (error) {
          return fail(source, error);
        }
      };
      const result = commitRestoration();
      if (result.ok && fromUrl && !matchesSavedLocation) navigation.notify(result.location);
      return result;
    } catch (error) {
      fail(source, error);
      try {
        if (missingPage(projectId, "replace", selectedModeId)) return fail(source, error);
        return commit(projectId, start(), "replace", `${source}StartFallback`);
      } catch (fallbackError) {
        return fail(source, fallbackError);
      }
    }
  };

  const onPopState = createPageHistoryReplay({
    projectId: () => input.registry.store.getState().projectId,
    removalEpoch: input.getResourceRemovalEpoch,
    adopt: history.adopt,
    resolve: resolveUrl,
    restore: input.navigateHistory
      ? (resolved, _projectId, removalVersion) =>
          normalizeStored(input.restoreHistoryLocation?.(resolved.location, removalVersion) ?? resolved.location)
      : restoreResolved,
    locationsEqual: (left, right) => workbenchPageLocationsEqual(left, right, resources, pages()),
    commit: (projectId, resolved, operation, action) =>
      input.navigateHistory?.(resolved.location, operation) ?? commit(projectId, resolved, operation, action),
    notify: navigation.notify,
    fail: (error) => missingPage(input.registry.store.getState().projectId, "none") || fail("history", error),
  });
  const popStateSubscription = input.browser.onPopState((entry) => {
    if (!replayUnavailablePage(input, history, publishUnavailable)) onPopState(entry);
  });
  const pageRemovalSubscription = connectPageOwnerRemoval({
    registry: input.registry,
    pages,
    resources,
    normalizeStored,
    start,
    commit,
    fail,
  });

  const closeActivePlacement = createPagePlacementCloser({
    commit,
    fail,
    getCurrent: () => input.registry.store.getState(),
    getPageRef: (pageId) => input.registry.getPage(pageId)?.ref,
    normalizeStored,
    resolveClosePlacement: internals.resolveClosePlacement,
  });

  const controller = createPageLocationControllerActions({
    input,
    historyStore: history.store,
    navigation,
    clearProject(projectId) {
      // The remembered root level belongs to the project the user is leaving.
      rootLevel.restore(undefined);
      memory.load(projectId, projectId ? input.persistence.load(projectId)?.remembered : undefined);
      internals.clearProject(projectId);
    },
    resetHistory: history.reset,
    rootLevelTarget: rootLevel.target,
    clearMissingPage: () => missingPage(input.registry.store.getState().projectId!, "push"),
    restore,
    resolveUrl,
    normalizeTarget: (target) => normalizeTarget(input, memory, target),
    normalizeStored,
    locationsEqual: (left, right) => workbenchPageLocationsEqual(left, right, resources, pages()),
    commit,
    replay: (projectId, resolved) =>
      createPageLocationReplayer({
        registry: input.registry,
        prepare: prepareState.open,
        publish,
        consumeRemembered: memory.consume,
      })(projectId, restoreResolved(resolved, projectId)),
    replaceParams: createPageParamsUpdater({ registry: input.registry, prepare: prepareState.open, publish }),
    select: createMainViewSelector({ prepare: prepareState.select, publish }),
    fail,
    closePlacement: closeActivePlacement,
    removeResource: createPageResourceRemover({
      getState: input.registry.store.getState,
      resources,
      forgetRootLevel: rootLevel.forget,
      forgetMemory: memory.forgetResource,
      persistence: input.persistence,
      start,
      commit,
    }),
    canGoBack: history.canGoBack,
    canGoForward: history.canGoForward,
    dispose() {
      popStateSubscription.dispose();
      pageRemovalSubscription();
    },
  });
  setPageLocationPreparation<Value>(controller, {
    resolve: (target) => normalizeTarget(input, memory, target),
    defaultTarget: start,
    commitUnavailable: publishUnavailable,
    commit: createPreparedPageLocationPublisher(input, publish, memory.consume),
  });
  return controller;
};
