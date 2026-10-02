import type { PageLocation } from "@pstdio/sdk/extensions";
import { isWorkbenchProjectUrl, parseWorkbenchPageUrl } from "@pstdio/sdk/extensions";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { createWorkbenchStore } from "../../shared/store/workbench-store";
import { createPageLocationControllerActions } from "./page-location-actions";
import { createPageHistoryEntry, createPageLocationFailureHandler } from "./page-location-history-entry";
import {
  normalizeDirectWorkbenchPageLocation,
  normalizeWorkbenchPageLocation,
  normalizeWorkbenchPageTarget,
  workbenchPageLocationRouteKey,
  workbenchPageLocationsEqual,
} from "./page-location-normalization";
import { setPageLocationPreparation } from "./page-location-preparation";
import { createPageLocationPublisher } from "./page-location-publish";
import { createRootLevelLocationTracker } from "./page-location-root-level";
import type {
  CreateWorkbenchPageLocationControllerInput,
  ResolvedPageLocation,
  WorkbenchPageBrowserEntry,
  WorkbenchPageHistoryState,
  WorkbenchPageLocationController,
  WorkbenchPageLocationHistoryState,
  WorkbenchPageNavigationResult,
} from "./page-location-types";
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

export const createWorkbenchPageLocationController = <Value>(
  input: CreateWorkbenchPageLocationControllerInput<Value>,
): WorkbenchPageLocationController => {
  const internals = getWorkbenchPageRegistryInternals(input.registry);
  const pages = () => input.registry.listPages();
  let historyIndex = 0;
  let maxHistoryIndex = 0;
  const historyStore = createWorkbenchStore<WorkbenchPageLocationHistoryState>({
    name: "workbench.page-location-history",
    initialState: { canGoBack: false, canGoForward: false },
  });
  const publishHistory = () =>
    historyStore.setState(
      { canGoBack: historyIndex > 0, canGoForward: historyIndex < maxHistoryIndex },
      false,
      "pageLocationHistory",
    );
  const resetHistory = () => {
    historyIndex = 0;
    maxHistoryIndex = 0;
    publishHistory();
  };

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
    getIndex: () => historyIndex,
    commitIndex: (index, push) => {
      historyIndex = index;
      if (push) maxHistoryIndex = index;
    },
    entry: historyEntry,
    publish: publishHistory,
    rememberRootLevel: rootLevel.remember,
  });
  const commit = (
    projectId: string,
    resolved: ResolvedPageLocation,
    history: "push" | "replace" | "none",
    action: string,
  ) => {
    const state = internals.prepare.location(
      {
        pageId: resolved.pageId,
        projectId,
        location: resolved.location,
        action,
        open: resolved.open,
        resource: resolved.location.resource,
        section: resolved.location.section,
        pageStates: resolved.pageStates,
      },
      input.registry.store.getState(),
    );
    return publish(projectId, state, history, action);
  };

  const normalizeStored = (location: PageLocation): ResolvedPageLocation =>
    normalizeWorkbenchPageLocation({ location, pages: pages(), resources: internals.resources });

  const start = (): ResolvedPageLocation =>
    normalizeWorkbenchPageTarget({
      target: { kind: "page", page: input.startPage },
      pages: pages(),
      resources: internals.resources,
    });

  const resolveUrl = (projectId: string, entry: WorkbenchPageBrowserEntry) => {
    const parsed = parseWorkbenchPageUrl({
      url: entry.url,
      projectId,
      pages: pages(),
      resources: internals.resources,
    });
    if (!parsed) return undefined;
    const direct = normalizeDirectWorkbenchPageLocation({
      ...parsed,
      pages: pages(),
      resources: internals.resources,
    });
    if (!isHistoryState(entry.state) || entry.state.projectId !== projectId) return direct;
    const contextual = normalizeStored(entry.state.location);
    const directKey = workbenchPageLocationRouteKey(direct.location, internals.resources);
    const contextualKey = workbenchPageLocationRouteKey(contextual.location, internals.resources);
    if (entry.state.routeKey !== directKey || contextualKey !== directKey) return direct;
    return contextual;
  };

  const restore = (
    projectId: string,
    source: "boot" | "project-switch",
    useCurrentUrl: boolean,
  ): WorkbenchPageNavigationResult => {
    try {
      const browserEntry = input.browser.current();
      if (isHistoryState(browserEntry.state) && browserEntry.state.projectId === projectId) {
        historyIndex = browserEntry.state.index;
        maxHistoryIndex = Math.max(maxHistoryIndex, historyIndex);
      } else {
        historyIndex = 0;
        maxHistoryIndex = 0;
      }
      const hasProjectUrl = useCurrentUrl && isWorkbenchProjectUrl(browserEntry.url, projectId);
      const fromUrl = hasProjectUrl ? resolveUrl(projectId, browserEntry) : undefined;
      if (hasProjectUrl && !fromUrl) throw new Error(`Cannot resolve page URL: ${browserEntry.url}`);
      // A URL wins over the saved location, but the saved root level still names the way out of a level.
      const persisted = input.persistence.load(projectId);
      rootLevel.restore(persisted?.rootLevel);
      const saved = hasProjectUrl ? undefined : persisted?.location;
      const resolved = fromUrl ?? (saved ? normalizeStored(saved) : start());
      return commit(projectId, resolved, "replace", source === "boot" ? "bootPageLocation" : "switchPageProject");
    } catch (error) {
      fail(source, error);
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
        historyIndex = entry.state.index;
        maxHistoryIndex = Math.max(maxHistoryIndex, historyIndex);
        publishHistory();
      }
      const resolved = resolveUrl(projectId, entry);
      if (!resolved) throw new Error(`Cannot resolve page URL: ${entry.url}`);
      commit(projectId, resolved, "none", "replayPageHistory");
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
    historyStore,
    clearProject(projectId) {
      // The remembered root level belongs to the project the user is leaving.
      rootLevel.restore(undefined);
      internals.clearProject(projectId);
    },
    resetHistory,
    rootLevelTarget: rootLevel.target,
    restore,
    resolveUrl,
    normalizeTarget: (target) =>
      normalizeWorkbenchPageTarget({
        target,
        pages: pages(),
        resources: internals.resources,
        active: input.registry.store.getState().location,
      }),
    normalizeStored,
    locationsEqual: (left, right) => workbenchPageLocationsEqual(left, right, internals.resources),
    commit,
    fail,
    closePlacement: closeActivePlacement,
    removeResource: createPageResourceRemover({
      getState: input.registry.store.getState,
      resources: internals.resources,
      forgetRootLevel: rootLevel.forget,
      commit,
    }),
    canGoBack: () => historyIndex > 0,
    canGoForward: () => historyIndex < maxHistoryIndex,
    dispose() {
      popStateSubscription.dispose();
      pageRemovalSubscription();
    },
  });
  setPageLocationPreparation<Value>(controller, {
    resolve: (target) =>
      normalizeWorkbenchPageTarget({
        target,
        pages: pages(),
        resources: internals.resources,
        active: input.registry.store.getState().location,
      }),
    commit: (state, beforePublish) => {
      if (!state.projectId || !state.location) throw new Error("Cannot navigate before a project is active");
      const history = workbenchPageLocationsEqual(
        input.registry.store.getState().location,
        state.location,
        internals.resources,
      )
        ? "none"
        : "push";
      return publish(state.projectId, state, history, "navigateCompoundTarget", beforePublish);
    },
  });
  return controller;
};
