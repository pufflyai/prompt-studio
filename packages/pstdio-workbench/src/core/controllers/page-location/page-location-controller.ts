import type { PageLocation } from "@pstdio/sdk/extensions";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { createWorkbenchStore } from "../../shared/store/workbench-store";
import { createPageLocationControllerActions } from "./page-location-actions";
import { isWorkbenchProjectUrl, parseWorkbenchPageUrl } from "./page-location-codec";
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
import type {
  CreateWorkbenchPageLocationControllerInput,
  ResolvedPageLocation,
  WorkbenchPageBrowserEntry,
  WorkbenchPageHistoryState,
  WorkbenchPageLocationController,
  WorkbenchPageLocationHistoryState,
  WorkbenchPageNavigationResult,
} from "./page-location-types";
import { createPagePlacementCloser } from "./page-placement-closer";

export type {
  CreateWorkbenchPageLocationControllerInput,
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

  const publish = createPageLocationPublisher(input, internals, {
    getIndex: () => historyIndex,
    commitIndex: (index, push) => {
      historyIndex = index;
      if (push) maxHistoryIndex = index;
    },
    entry: historyEntry,
    publish: publishHistory,
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
      const saved = hasProjectUrl ? undefined : input.persistence.load(projectId);
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
  const pageRemovalSubscription = input.registry.store.subscribe((state, previous) => {
    const removedPage = Object.keys(previous.pages).some((pageId) => !state.pages[pageId]);
    if (!removedPage || !state.projectId) return;
    try {
      if (state.location) {
        normalizeStored(state.location);
        return;
      }
    } catch (error) {
      fail("navigation", error);
    }
    try {
      const active = state.activePageId ? state.pages[state.activePageId] : undefined;
      const resolved =
        active && state.location
          ? normalizeDirectWorkbenchPageLocation({
              pageId: active.id,
              pages: pages(),
              resources: internals.resources,
              ...(state.location.resource ? { resource: state.location.resource } : {}),
              ...(state.location.section ? { section: state.location.section } : {}),
            })
          : start();
      commit(state.projectId, resolved, "replace", "removePageLocationOwner");
    } catch (error) {
      fail("navigation", error);
    }
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
    clearProject: internals.clearProject,
    resetHistory,
    restore,
    resolveUrl,
    normalizeTarget: (target) =>
      normalizeWorkbenchPageTarget({
        target,
        pages: pages(),
        resources: internals.resources,
      }),
    normalizeStored,
    locationsEqual: (left, right) => workbenchPageLocationsEqual(left, right, internals.resources),
    commit,
    fail,
    closePlacement: closeActivePlacement,
    canGoBack: () => historyIndex > 0,
    canGoForward: () => historyIndex < maxHistoryIndex,
    dispose() {
      popStateSubscription.dispose();
      pageRemovalSubscription();
    },
  });
  setPageLocationPreparation<Value>(controller, {
    resolve: (target) => normalizeWorkbenchPageTarget({ target, pages: pages(), resources: internals.resources }),
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
