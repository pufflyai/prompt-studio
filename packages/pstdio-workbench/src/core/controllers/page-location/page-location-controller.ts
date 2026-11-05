import type { NavigationTargetPage, PageLocation } from "@pstdio/sdk/extensions";
import { isWorkbenchProjectUrl } from "pstdio-api-contracts";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { batchWorkbenchChanges } from "../../shared/store/workbench-batch";
import { createWorkbenchEvent } from "../../shared/workbench-event";
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
} from "./page-location-publish";
import { restoreRememberedLocation } from "./page-location-restoration";
import { createRootLevelLocationTracker } from "./page-location-root-level";
import type {
  CreateWorkbenchPageLocationControllerInput,
  ResolvedPageLocation,
  WorkbenchPageLocationController,
  WorkbenchPageNavigationResult,
} from "./page-location-types";
import { createPageNavigationMemory } from "./page-navigation-memory";
import { connectPageOwnerRemoval } from "./page-owner-removal";
import { createPagePlacementCloser } from "./page-placement-closer";
import { createPageResourceRemover } from "./page-resource-remover";
import { createPageUrlResolver, isPageHistoryState } from "./page-url-resolver";

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

// Missing pages reuse the selected mode, layout persistence and existing page-history entries.
const clearMissingPage = <Value>(
  input: CreateWorkbenchPageLocationControllerInput<Value>,
  history: ReturnType<typeof createPageLocationHistory>,
  entry: ReturnType<typeof createPageHistoryEntry>,
  projectId: string | undefined,
  operation: "push" | "replace" | "none",
  selectedModeId?: string,
) => {
  const internals = getWorkbenchPageRegistryInternals(input.registry);
  if (!projectId) return false;
  if (operation === "none") {
    const current = input.browser.current();
    if (
      !isWorkbenchProjectUrl(current.url, projectId) ||
      (isPageHistoryState(current.state) && current.state.projectId !== projectId)
    )
      return false;
    const location = isPageHistoryState(current.state) ? current.state.location : undefined;
    const removedDefault =
      location?.page &&
      location.page.extensionId === input.startPage.extensionId &&
      location.page.id === input.startPage.id;
    if (
      !removedDefault &&
      new URL(current.url, "http://workbench.local").pathname.replace(/\/$/, "") !==
        `/projects/${encodeURIComponent(projectId)}`
    )
      return false;
  }
  if (
    input.registry
      .listPages()
      .some((page) => page.ref.extensionId === input.startPage.extensionId && page.ref.id === input.startPage.id)
  )
    return false;
  return batchWorkbenchChanges(() => {
    const current = input.registry.store.getState();
    const state = internals.prepare.compose(current, {
      projectId,
      activeModeId: input.modes.getActiveModeId?.() ?? selectedModeId ?? current.activeModeId,
      pageStates: current.pageStates,
      action: "unavailablePage",
    });
    const index = history.getIndex() + (operation === "push" ? 1 : 0);
    if (operation !== "none") input.browser[operation](entry(projectId, undefined, index));
    history.commitIndex(index, operation === "push");
    internals.publish(state, "unavailablePage");
    history.publish();
    return true;
  });
};

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

  const start = (): ResolvedPageLocation =>
    normalizeWorkbenchPageTarget({
      target: { kind: "page", page: input.startPage },
      pages: pages(),
      resources,
    });

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
      const hasProjectUrl = useCurrentUrl && isWorkbenchProjectUrl(browserEntry.url, projectId);
      const fromUrl = hasProjectUrl ? resolveUrl(projectId, browserEntry) : undefined;
      if (hasProjectUrl && !fromUrl) throw new Error(`Cannot resolve page URL: ${browserEntry.url}`);
      // A URL wins over the saved location, but the saved root level still names the way out of a level.
      const persisted = input.persistence.load(projectId);
      memory.load(projectId, persisted?.remembered);
      rootLevel.restore(persisted?.rootLevel);
      const saved = hasProjectUrl ? undefined : persisted?.location;
      const resolved = restoreResolved(fromUrl ?? (saved ? normalizeStored(saved) : start()), projectId);
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
    restore: restoreResolved,
    locationsEqual: (left, right) => workbenchPageLocationsEqual(left, right, resources, pages()),
    commit,
    notify: navigation.notify,
    fail: (error) => missingPage(input.registry.store.getState().projectId, "none") || fail("history", error),
  });
  const popStateSubscription = input.browser.onPopState(onPopState);
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
    commit: (state, beforePublish, consumeRemembered = []) => {
      if (!state.projectId || !state.location) throw new Error("Cannot navigate before a project is active");
      const history = workbenchPageLocationsEqual(
        input.registry.store.getState().location,
        state.location,
        resources,
        pages(),
      )
        ? "none"
        : "push";
      return publish(state.projectId, state, history, "navigateCompoundTarget", () => {
        beforePublish?.();
        for (const location of consumeRemembered) memory.consume(location);
      });
    },
  });
  return controller;
};
