import type { NavigationTargetPage, PageLocation, PageRef, PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchPageRegistry, WorkbenchPageRuntimeState } from "../../registries/pages/page-registry";
import {
  getWorkbenchPageRegistryInternals,
  type WorkbenchPageCloseResolution,
} from "../../registries/pages/page-registry-internals";
import { isWorkbenchProjectUrl, parseWorkbenchPageUrl, serializeWorkbenchPageUrl } from "./page-location-codec";
import {
  normalizeDirectWorkbenchPageLocation,
  normalizeWorkbenchPageLocation,
  normalizeWorkbenchPageTarget,
  workbenchPageLocationRouteKey,
} from "./page-location-normalization";

export interface WorkbenchPageBrowserEntry {
  url: string;
  state?: unknown;
}

export interface WorkbenchPageLocationBrowser {
  current(): WorkbenchPageBrowserEntry;
  push(entry: WorkbenchPageBrowserEntry): void;
  replace(entry: WorkbenchPageBrowserEntry): void;
  onPopState(listener: (entry: WorkbenchPageBrowserEntry) => void): { dispose(): void };
}

export interface WorkbenchPageLocationPersistence {
  load(projectId: string): PageLocation | undefined;
  save(projectId: string, location: PageLocation): void;
}

export interface WorkbenchPageLocationDiagnostic {
  code: "page-location-unresolved";
  source: "boot" | "history" | "navigation" | "project-switch";
  message: string;
}

export interface WorkbenchPageHistoryState {
  kind: "pstdio.page-location";
  projectId: string;
  routeKey: string;
  location: PageLocation;
}

interface WorkbenchModeLocationState {
  kind: "pstdio.mode-location";
  modeId: string;
  projectId: string;
}

export type WorkbenchPageNavigationResult =
  | { ok: true; location: PageLocation }
  | { ok: false; diagnostic: WorkbenchPageLocationDiagnostic };

export interface CreateWorkbenchPageLocationControllerInput<Value> {
  registry: WorkbenchPageRegistry<Value>;
  browser: WorkbenchPageLocationBrowser;
  persistence: WorkbenchPageLocationPersistence;
  startPage: PageRef;
  reportDiagnostic?(diagnostic: WorkbenchPageLocationDiagnostic): void;
}

export interface WorkbenchPageLocationController {
  setProject(projectId: string): void;
  leavePage(modeId: string): void;
  isCurrentProjectUrl(projectId: string): boolean;
  hasCurrentPageUrl(projectId: string): boolean;
  hasCurrentModeUrl(projectId: string): boolean;
  boot(projectId: string): WorkbenchPageNavigationResult;
  switchProject(projectId: string): WorkbenchPageNavigationResult;
  navigate(target: NavigationTargetPage): WorkbenchPageNavigationResult;
  replay(location: PageLocation): WorkbenchPageNavigationResult;
  navigateToParent(): WorkbenchPageNavigationResult;
  closePlacement(identity: PlacementIdentity): WorkbenchPageNavigationResult;
  dispose(): void;
}

interface ResolvedLocation {
  pageId: string;
  location: PageLocation;
  open?: NavigationTargetPage["open"];
  pageStates?: Readonly<Record<string, WorkbenchPageRuntimeState>>;
}

const isHistoryState = (value: unknown): value is WorkbenchPageHistoryState => {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<WorkbenchPageHistoryState>;
  return (
    state.kind === "pstdio.page-location" &&
    typeof state.projectId === "string" &&
    typeof state.routeKey === "string" &&
    Boolean(state.location && typeof state.location === "object")
  );
};

const isModeLocationState = (value: unknown): value is WorkbenchModeLocationState => {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<WorkbenchModeLocationState>;
  return (
    state.kind === "pstdio.mode-location" && typeof state.modeId === "string" && typeof state.projectId === "string"
  );
};

const hasResolvableCurrentPageUrl = (
  browser: WorkbenchPageLocationBrowser,
  projectId: string,
  resolveUrl: (projectId: string, entry: WorkbenchPageBrowserEntry) => ResolvedLocation | undefined,
) => {
  try {
    return Boolean(resolveUrl(projectId, browser.current()));
  } catch {
    return false;
  }
};

interface PagePlacementCloserInput {
  commit(
    projectId: string,
    resolved: ResolvedLocation,
    history: "push" | "replace" | "none",
    action: string,
  ): WorkbenchPageNavigationResult;
  fail(source: "navigation", error: unknown): WorkbenchPageNavigationResult;
  getCurrent(): { projectId?: string; location?: PageLocation };
  getPageRef(pageId: string): PageRef | undefined;
  normalizePage(page: PageRef): ResolvedLocation;
  normalizeStored(location: PageLocation): ResolvedLocation;
  resolveClosePlacement(identity: PlacementIdentity): WorkbenchPageCloseResolution;
}

const createPagePlacementCloser = (input: PagePlacementCloserInput) => {
  const closeToParent = (
    projectId: string,
    location: PageLocation,
    resolution: Extract<WorkbenchPageCloseResolution, { kind: "parent" }>,
  ) => {
    const contextualParent = location.parent ? input.normalizeStored(location.parent) : undefined;
    const parent = input.getPageRef(resolution.parentId);
    if (!parent) throw new Error(`Unknown parent page: ${resolution.parentId}`);
    const resolved = contextualParent?.pageId === resolution.parentId ? contextualParent : input.normalizePage(parent);
    return input.commit(
      projectId,
      { ...resolved, pageStates: resolution.pageStates },
      "replace",
      "closePagePlacementToParent",
    );
  };

  const closeWithinPage = (
    projectId: string,
    location: PageLocation,
    resolution: Extract<WorkbenchPageCloseResolution, { kind: "stay" }>,
  ) => {
    const page = input.getPageRef(resolution.target.pageId);
    if (!page) throw new Error(`Unknown page: ${resolution.target.pageId}`);
    const resolved = input.normalizeStored({
      page,
      ...(resolution.target.resource ? { resource: resolution.target.resource } : {}),
      ...(resolution.target.section ? { section: resolution.target.section } : {}),
      ...(location.parent ? { parent: location.parent } : {}),
    });
    return input.commit(
      projectId,
      {
        ...resolved,
        pageStates: resolution.pageStates,
        ...(resolution.target.open ? { open: resolution.target.open } : {}),
      },
      resolution.locationChanged ? "replace" : "none",
      "closePagePlacement",
    );
  };

  return (identity: PlacementIdentity) => {
    const current = input.getCurrent();
    if (!current.projectId || !current.location) {
      return input.fail("navigation", new Error("Cannot close a page placement without an active location"));
    }
    try {
      if (identity.kind !== "page") throw new Error("Only page-owned placements can close through page navigation");
      const resolution = input.resolveClosePlacement(identity);
      return resolution.kind === "parent"
        ? closeToParent(current.projectId, current.location, resolution)
        : closeWithinPage(current.projectId, current.location, resolution);
    } catch (error) {
      return input.fail("navigation", error);
    }
  };
};

export const createWorkbenchPageLocationController = <Value>(
  input: CreateWorkbenchPageLocationControllerInput<Value>,
): WorkbenchPageLocationController => {
  const internals = getWorkbenchPageRegistryInternals(input.registry);
  const pages = () => input.registry.listPages();

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
      projectId,
      routeKey: workbenchPageLocationRouteKey(location, internals.resources),
      location,
    } satisfies WorkbenchPageHistoryState,
  });

  const commit = (
    projectId: string,
    resolved: ResolvedLocation,
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
    if (history !== "none") input.browser[history](historyEntry(projectId, resolved.location));
    return { ok: true, location: resolved.location } as const;
  };

  const normalizeStored = (location: PageLocation): ResolvedLocation =>
    normalizeWorkbenchPageLocation({ location, pages: pages(), resources: internals.resources });

  const start = (): ResolvedLocation =>
    normalizeWorkbenchPageTarget({
      target: { kind: "page", page: input.startPage },
      pages: pages(),
      resources: internals.resources,
    });

  const resolveUrl = (projectId: string, entry: WorkbenchPageBrowserEntry) => {
    if (isModeLocationState(entry.state) && entry.state.projectId === projectId) return undefined;
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

  return {
    setProject(projectId) {
      if (input.registry.store.getState().projectId === projectId) return;
      internals.clearProject(projectId);
    },

    leavePage(modeId) {
      const projectId = input.registry.store.getState().projectId;
      if (!projectId) return;
      internals.activateMode(projectId, modeId);
      input.browser.replace({
        url: `/projects/${encodeURIComponent(projectId)}`,
        state: { kind: "pstdio.mode-location", modeId, projectId } satisfies WorkbenchModeLocationState,
      });
    },

    isCurrentProjectUrl: (projectId) => isWorkbenchProjectUrl(input.browser.current().url, projectId),

    hasCurrentPageUrl: (projectId) => hasResolvableCurrentPageUrl(input.browser, projectId, resolveUrl),

    hasCurrentModeUrl: (projectId) => {
      const state = input.browser.current().state;
      return isModeLocationState(state) && state.projectId === projectId;
    },

    boot(projectId) {
      return restore(projectId, "boot", true);
    },

    switchProject(projectId) {
      internals.clearProject(projectId);
      return restore(projectId, "project-switch", false);
    },

    navigate(target) {
      const projectId = input.registry.store.getState().projectId;
      if (!projectId) return fail("navigation", new Error("Cannot navigate before a project is active"));
      try {
        const resolved = normalizeWorkbenchPageTarget({ target, pages: pages(), resources: internals.resources });
        return commit(projectId, resolved, "push", "navigatePageLocation");
      } catch (error) {
        return fail("navigation", error);
      }
    },

    replay(location) {
      const projectId = input.registry.store.getState().projectId;
      if (!projectId) return fail("history", new Error("Cannot replay a page before a project is active"));
      try {
        return commit(projectId, normalizeStored(location), "replace", "replayWorkbenchPageHistory");
      } catch (error) {
        return fail("history", error);
      }
    },

    navigateToParent() {
      const current = input.registry.store.getState();
      if (!current.projectId || !current.location?.parent) {
        return fail("navigation", new Error("The active page does not have a parent location"));
      }
      try {
        return commit(
          current.projectId,
          normalizeStored(current.location.parent),
          "replace",
          "navigateToParentPageLocation",
        );
      } catch (error) {
        return fail("navigation", error);
      }
    },

    closePlacement(identity) {
      return closeActivePlacement(identity);
    },

    dispose() {
      popStateSubscription.dispose();
      pageRemovalSubscription();
    },
  };
};
