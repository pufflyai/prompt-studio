import type { PageLocation } from "@pstdio/sdk/extensions";
import { isWorkbenchProjectUrl, parseWorkbenchPageUrl } from "pstdio-api-contracts";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { createWorkbenchEvent } from "../../shared/workbench-event";
import { createPageLocationControllerActions } from "./page-location-actions";
import {
  createPageHistoryEntry,
  createPageLocationFailureHandler,
  createPageLocationHistory,
} from "./page-location-history-entry";
import {
  normalizeDirectWorkbenchPageLocation,
  normalizeWorkbenchPageTarget,
  workbenchPageLocationRouteKey,
  workbenchPageLocationsEqual,
} from "./page-location-normalization";
import { setPageLocationPreparation } from "./page-location-preparation";
import {
  createPageLocationPreparer,
  createPageLocationPublisher,
  createPageLocationReplayer,
} from "./page-location-publish";
import { createPageLocationResolution } from "./page-location-resolution";
import { createRootLevelLocationTracker } from "./page-location-root-level";
import type {
  CreateWorkbenchPageLocationControllerInput,
  ResolvedPageLocation,
  WorkbenchPageBrowserEntry,
  WorkbenchPageHistoryState,
  WorkbenchPageLocationController,
  WorkbenchPageNavigationResult,
} from "./page-location-types";
import { createPageModeMemory, resolveLocationMode } from "./page-mode-locations";
import { connectPageOwnerRemoval } from "./page-owner-removal";
import { createPagePlacementCloser } from "./page-placement-closer";
import { createPageResourceRemover } from "./page-resource-remover";

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

const isHistoryState = (value: unknown): value is WorkbenchPageHistoryState => {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<WorkbenchPageHistoryState>;
  return (
    state.kind === "pstdio.page-location" &&
    typeof state.index === "number" &&
    typeof state.projectId === "string" &&
    typeof state.routeKey === "string" &&
    Boolean(state.location && typeof state.location === "object")
  );
};

const locationWithUrlParams = (direct: PageLocation, contextual: PageLocation) => {
  const { params: previous, ...location } = contextual;
  return { ...location, ...(direct.params ? { params: direct.params } : {}) };
};

export const createWorkbenchPageLocationController = <Value>(
  input: CreateWorkbenchPageLocationControllerInput<Value>,
): WorkbenchPageLocationController => {
  const navigation = createWorkbenchEvent<PageLocation>("page navigation subscriber");
  const internals = getWorkbenchPageRegistryInternals(input.registry);
  const pages = input.registry.listPages;
  const history = createPageLocationHistory();
  const modeMemory = createPageModeMemory({
    pages,
    modes: input.modes,
    resourceKey: (resource) => internals.resources.toUri(internals.resources.normalize(resource)),
  });
  const activeModeId = () => input.registry.store.getState().activeModeId;

  const fail = createPageLocationFailureHandler(input.reportDiagnostic);
  const historyEntry = createPageHistoryEntry({ pages, resources: internals.resources });

  const rootLevel = createRootLevelLocationTracker({
    levels: input,
    pages,
    normalize: (location) => normalizeStored(location),
    resourceKey: (resource) => internals.resources.toUri(internals.resources.normalize(resource)),
    start: () => start(),
  });

  const publish = createPageLocationPublisher(input, internals, {
    getIndex: history.getIndex,
    commitIndex: history.commitIndex,
    entry: historyEntry,
    publish: history.publish,
    rememberRootLevel: rootLevel.remember,
    rememberMode: modeMemory.remember,
  });
  const prepareState = createPageLocationPreparer(input.registry);
  const commit = (
    projectId: string,
    resolved: ResolvedPageLocation,
    history: "push" | "replace" | "none",
    action: string,
  ) => publish(projectId, prepareState.open(projectId, resolved, action), history, action);

  const { normalizeRawStored, normalizeStored, normalizeTarget, start } = createPageLocationResolution(
    input,
    internals.resources,
  );

  const resolveUrl = (projectId: string, entry: WorkbenchPageBrowserEntry) => {
    const parsed = parseWorkbenchPageUrl({
      url: entry.url,
      projectId,
      pages: pages(),
      resources: internals.resources,
    });
    if (!parsed) return undefined;
    const direct = resolveLocationMode(
      normalizeDirectWorkbenchPageLocation({
        ...parsed,
        pages: pages(),
        resources: internals.resources,
      }),
      pages(),
      activeModeId(),
    );
    const current = { ...input.registry.store.getState(), projectId };
    if (!isHistoryState(entry.state) || entry.state.projectId !== projectId)
      return normalizeStored(direct.location, current);
    const contextual = normalizeRawStored(entry.state.location);
    const directKey = workbenchPageLocationRouteKey(direct.location, internals.resources, pages());
    const contextualKey = workbenchPageLocationRouteKey(contextual.location, internals.resources, pages());
    if (entry.state.routeKey !== directKey || contextualKey !== directKey)
      return normalizeStored(direct.location, current);
    return normalizeStored(locationWithUrlParams(direct.location, contextual.location), current);
  };

  const restore = (
    projectId: string,
    source: "boot" | "project-switch",
    useCurrentUrl: boolean,
  ): WorkbenchPageNavigationResult => {
    try {
      const browserEntry = input.browser.current();
      if (isHistoryState(browserEntry.state) && browserEntry.state.projectId === projectId) {
        history.adopt(browserEntry.state.index);
      } else {
        history.reset();
      }
      const persisted = input.persistence.load(projectId);
      rootLevel.restore(persisted?.rootLevel);
      modeMemory.restore(persisted?.modeLocations);
      const hasProjectUrl = useCurrentUrl && isWorkbenchProjectUrl(browserEntry.url, projectId);
      const fromUrl = hasProjectUrl ? resolveUrl(projectId, browserEntry) : undefined;
      if (hasProjectUrl && !fromUrl) throw new Error(`Cannot resolve page URL: ${browserEntry.url}`);
      // A URL wins over the saved location, but the saved root level still names the way out of a level.
      const saved = hasProjectUrl ? undefined : persisted?.location;
      const resolved =
        fromUrl ?? (saved ? normalizeStored(saved, { ...input.registry.store.getState(), projectId }) : start());
      const action = source === "boot" ? "bootPageLocation" : "switchPageProject";
      const matchesSavedLocation = workbenchPageLocationsEqual(
        persisted?.location,
        resolved.location,
        internals.resources,
        pages(),
      );
      const prepare = matchesSavedLocation ? prepareState.restore : prepareState.open;
      const result = publish(projectId, prepare(projectId, resolved, action), "replace", action);
      if (result.ok && fromUrl && !matchesSavedLocation) navigation.notify(result.location);
      return result;
    } catch (error) {
      const failure = fail(source, error);
      if (input.registry.store.getState().location) return failure;
      try {
        return commit(projectId, start(), "replace", `${source}StartFallback`);
      } catch (fallbackError) {
        return fail(source, fallbackError);
      }
    }
  };

  const onPopState = (entry: WorkbenchPageBrowserEntry) => {
    const projectId = input.registry.store.getState().projectId;
    if (!projectId) return;
    try {
      if (isHistoryState(entry.state) && entry.state.projectId === projectId) {
        history.adopt(entry.state.index);
      }
      const resolved = resolveUrl(projectId, entry);
      if (!resolved) throw new Error(`Cannot resolve page URL: ${entry.url}`);
      const canonical = historyEntry(projectId, resolved.location, history.getIndex());
      const result = commit(projectId, resolved, canonical.url === entry.url ? "none" : "replace", "replayPageHistory");
      if (result.ok) navigation.notify(result.location);
    } catch (error) {
      fail("history", error);
    }
  };
  const popStateSubscription = input.browser.onPopState(onPopState);
  const pageRemovalSubscription = connectPageOwnerRemoval({
    registry: input.registry,
    pages,
    resources: internals.resources,
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
    normalizePage: (page) =>
      normalizeWorkbenchPageTarget({
        target: { kind: "page", page },
        pages: pages(),
        resources: internals.resources,
      }),
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
      modeMemory.restore();
      internals.clearProject(projectId);
    },
    resetHistory: history.reset,
    rootLevelTarget: rootLevel.target,
    restore,
    resolveUrl,
    normalizeTarget,
    modeTarget: (modeId) => normalizeStored(modeMemory.target(modeId)),
    normalizeStored,
    locationsEqual: (left, right) => workbenchPageLocationsEqual(left, right, internals.resources, pages()),
    commit,
    replay: createPageLocationReplayer({ registry: input.registry, prepare: prepareState.open, publish }),
    fail,
    closePlacement: closeActivePlacement,
    removeResource: createPageResourceRemover({
      getState: input.registry.store.getState,
      resources: internals.resources,
      forgetRootLevel: (resource) => {
        rootLevel.forget(resource);
        modeMemory.forget(resource);
      },
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
    resolve: normalizeTarget,
    modeLocation: modeMemory.target,

    commit: (state, beforePublish, requestedHistory) => {
      if (!state.projectId || !state.location) throw new Error("Cannot navigate before a project is active");
      const history = workbenchPageLocationsEqual(
        input.registry.store.getState().location,
        state.location,
        internals.resources,
        pages(),
      )
        ? "none"
        : "push";
      return publish(state.projectId, state, requestedHistory ?? history, "navigateCompoundTarget", beforePublish);
    },
  });
  return controller;
};
