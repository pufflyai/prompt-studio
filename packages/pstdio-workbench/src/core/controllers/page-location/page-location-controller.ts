import type { NavigationTargetPage, PageLocation } from "@pstdio/sdk/extensions";
import { getWorkbenchPageRegistryInternals } from "../../registries/pages/page-registry-internals";
import { createWorkbenchStore } from "../../shared/store/workbench-store";
import { createPageEditorCommit, createPreparedPageCommit } from "./page-editor-commit";
import { createPageLocationControllerActions } from "./page-location-actions";
import { createPageHistoryEntry, createPageLocationFailureHandler } from "./page-location-history-entry";
import {
  normalizeWorkbenchPageLocation,
  normalizeWorkbenchPageTarget,
  workbenchPageLocationsEqual,
} from "./page-location-normalization";
import { setPageLocationPreparation } from "./page-location-preparation";
import { createPageLocationPublisher } from "./page-location-publish";
import { createPageLocationRestorer, isPageHistoryState as isHistoryState } from "./page-location-restoration";
import { createRootLevelLocationTracker } from "./page-location-root-level";
import type {
  CreateWorkbenchPageLocationControllerInput,
  ResolvedPageLocation,
  WorkbenchPageBrowserEntry,
  WorkbenchPageLocationController,
  WorkbenchPageLocationHistoryState,
} from "./page-location-types";
import { resolvePageLocationUrl } from "./page-location-url";
import {
  createPageModeMemory,
  resolveLocationMode,
  resolvePageTargetMode,
  resolveStartPageLocation,
} from "./page-mode-locations";
import { connectPageOwnerRemoval } from "./page-owner-removal";
import { createPagePlacementCloser } from "./page-placement-closer";
import { createPageResourceRemover } from "./page-resource-remover";
import { createProjectPageResourceKey } from "./project-page-resource-key";

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

export const createWorkbenchPageLocationController = <Value>(
  input: CreateWorkbenchPageLocationControllerInput<Value>,
): WorkbenchPageLocationController => {
  const internals = getWorkbenchPageRegistryInternals(input.registry);
  const pages = input.registry.listPages;
  const resourceKey = createProjectPageResourceKey(
    internals.resources,
    () => input.registry.store.getState().projectId,
  );
  const modeMemory = createPageModeMemory({
    pages,
    modes: input.modes,
    resourceKey,
  });
  const activeModeId = () => input.registry.store.getState().activeModeId;
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
    [historyIndex, maxHistoryIndex] = [0, 0];
    publishHistory();
  };

  const fail = createPageLocationFailureHandler(input.reportDiagnostic);
  const historyEntry = createPageHistoryEntry({ pages, resources: internals.resources });

  const rootLevel = createRootLevelLocationTracker({
    levels: input,
    pages,
    normalize: (location) => normalizeStored(location),
    resourceKey,
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
    rememberMode: modeMemory.remember,
  });
  const commitExistingEditor = createPageEditorCommit(input, publish, internals.resources);
  const commit = (
    projectId: string,
    resolved: ResolvedPageLocation,
    history: "push" | "replace" | "none",
    action: string,
    beforePublish?: () => void,
  ) => {
    const existing = commitExistingEditor(projectId, resolved, history, action, beforePublish);
    if (existing) return existing;
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
    return publish(projectId, state, history, action, beforePublish);
  };

  const normalizeStored = (location: PageLocation): ResolvedPageLocation =>
    resolveLocationMode(
      normalizeWorkbenchPageLocation({ location, pages: pages(), resources: internals.resources }),
      pages(),
      activeModeId(),
    );

  const start = () => resolveStartPageLocation(input.startPage, pages(), internals.resources, activeModeId());

  const normalizeTarget = (target: NavigationTargetPage, modeId = activeModeId()) => ({
    requested: target,
    ...resolveLocationMode(
      normalizeWorkbenchPageTarget({
        target: resolvePageTargetMode(target, pages(), modeId),
        pages: pages(),
        resources: internals.resources,
        active: input.registry.store.getState().location,
      }),
      pages(),
      modeId,
    ),
  });

  const resolveUrl = (projectId: string, entry: WorkbenchPageBrowserEntry) =>
    resolvePageLocationUrl({
      projectId,
      entry,
      pages: pages(),
      resources: internals.resources,
      activeModeId: activeModeId(),
      normalizeStored,
    });

  const restore = createPageLocationRestorer({
    browser: input.browser,
    persistence: input.persistence,
    resolveUrl,
    normalizeStored,
    start,
    commit,
    fail,
    restoreRoot: rootLevel.restore,
    restoreModes: modeMemory.restore,
    modeTarget: modeMemory.target,
    restoreHistory(entry, projectId) {
      if (isHistoryState(entry.state) && entry.state.projectId === projectId) {
        historyIndex = entry.state.index;
        maxHistoryIndex = Math.max(maxHistoryIndex, historyIndex);
      } else {
        historyIndex = 0;
        maxHistoryIndex = 0;
      }
    },
  });

  const onPopState = (entry: WorkbenchPageBrowserEntry) => {
    const projectId = input.registry.store.getState().projectId;
    if (!projectId) return;
    try {
      const resolved = resolveUrl(projectId, entry);
      if (!resolved) throw new Error(`Cannot resolve page URL: ${entry.url}`);
      commit(projectId, resolved, "none", "replayPageHistory", () => {
        if (isHistoryState(entry.state) && entry.state.projectId === projectId) {
          historyIndex = entry.state.index;
          maxHistoryIndex = Math.max(maxHistoryIndex, historyIndex);
          publishHistory();
        }
      });
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
    resolvePlacementLocation: input.resolvePlacementLocation,
  });

  const controller = createPageLocationControllerActions({
    input,
    historyStore,
    clearProject(projectId) {
      // The remembered root level belongs to the project the user is leaving.
      rootLevel.restore(undefined);
      modeMemory.restore();
      internals.clearProject(projectId);
    },
    resetHistory,
    rootLevelTarget: rootLevel.target,
    restore,
    resolveUrl,
    normalizeTarget,
    normalizeStored,
    modeTarget: modeMemory.target,
    locationsEqual: (left, right) => workbenchPageLocationsEqual(left, right, internals.resources, pages()),
    commit,
    fail,
    closePlacement: closeActivePlacement,
    removeResource: createPageResourceRemover({
      getState: input.registry.store.getState,
      resources: internals.resources,
      forgetLocations: [rootLevel.forget, modeMemory.forget],
      start,
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
    resolve: normalizeTarget,
    commit: createPreparedPageCommit(input, publish, internals.resources),
  });
  return controller;
};
