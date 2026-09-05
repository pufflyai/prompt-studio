import type { PageLocation } from "@pstdio/sdk/extensions";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { createWorkbenchStore } from "../../shared/store/workbench-store";
import { createPageLocationControllerActions } from "./page-location-actions";
import { isWorkbenchProjectUrl, parseWorkbenchPageUrl, serializeWorkbenchPageUrl } from "./page-location-codec";
import {
  normalizeDirectWorkbenchPageLocation,
  normalizeWorkbenchPageLocation,
  normalizeWorkbenchPageTarget,
  workbenchPageLocationRouteKey,
  workbenchPageLocationsEqual,
} from "./page-location-normalization";
import type {
  CreateWorkbenchPageLocationControllerInput,
  ResolvedPageLocation,
  WorkbenchPageBrowserEntry,
  WorkbenchPageHistoryState,
  WorkbenchPageLocationController,
  WorkbenchPageLocationDiagnostic,
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

  const fail = (source: WorkbenchPageLocationDiagnostic["source"], error: unknown): WorkbenchPageNavigationResult => {
    const diagnostic: WorkbenchPageLocationDiagnostic = {
      code: "page-location-unresolved",
      source,
      message: error instanceof Error ? error.message : String(error),
    };
    input.reportDiagnostic?.(diagnostic);
    return { ok: false, diagnostic };
  };

  const historyEntry = (projectId: string, location: PageLocation): WorkbenchPageBrowserEntry => ({
    url: serializeWorkbenchPageUrl({ projectId, location, pages: pages(), resources: internals.resources }),
    state: {
      kind: "pstdio.page-location",
      index: historyIndex,
      projectId,
      routeKey: workbenchPageLocationRouteKey(location, internals.resources),
      location,
    } satisfies WorkbenchPageHistoryState,
  });

  const commit = (
    projectId: string,
    resolved: ResolvedPageLocation,
    history: "push" | "replace" | "none",
    action: string,
  ) => {
    internals.activateLocation({
      pageId: resolved.pageId,
      projectId,
      location: resolved.location,
      action,
      ...(resolved.open ? { open: resolved.open } : {}),
      ...(resolved.location.resource ? { resource: resolved.location.resource } : {}),
      ...(resolved.location.section ? { section: resolved.location.section } : {}),
      ...(resolved.pageStates ? { pageStates: resolved.pageStates } : {}),
    });
    input.persistence.save(projectId, resolved.location);
    if (history === "push") {
      historyIndex += 1;
      maxHistoryIndex = historyIndex;
      input.browser.push(historyEntry(projectId, resolved.location));
      publishHistory();
    } else if (history === "replace") {
      input.browser.replace(historyEntry(projectId, resolved.location));
      publishHistory();
    }
    return { ok: true, location: resolved.location } as const;
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

  return createPageLocationControllerActions({
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
};
