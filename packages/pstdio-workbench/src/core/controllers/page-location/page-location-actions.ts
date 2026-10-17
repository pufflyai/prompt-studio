import type { NavigationTargetPage, PageLocation, PlacementIdentity, ResourceRef } from "@pstdio/sdk/extensions";
import { isWorkbenchProjectUrl, normalizePageParams } from "pstdio-api-contracts";
import type { WorkbenchStore } from "../../shared/store/workbench-store";
import type {
  CreateWorkbenchPageLocationControllerInput,
  ResolvedPageLocation,
  WorkbenchPageBrowserEntry,
  WorkbenchPageLocationController,
  WorkbenchPageLocationDiagnostic,
  WorkbenchPageLocationHistoryState,
  WorkbenchPageNavigationResult,
} from "./page-location-types";

interface PageLocationControllerActionsInput<Value> {
  input: CreateWorkbenchPageLocationControllerInput<Value>;
  historyStore: WorkbenchStore<WorkbenchPageLocationHistoryState>;
  clearProject(projectId: string | undefined): void;
  resetHistory(): void;
  rootLevelTarget(): ResolvedPageLocation;
  restore(projectId: string, source: "boot" | "project-switch", useCurrentUrl: boolean): WorkbenchPageNavigationResult;
  resolveUrl(projectId: string, entry: WorkbenchPageBrowserEntry): ResolvedPageLocation | undefined;
  normalizeTarget(target: NavigationTargetPage): ResolvedPageLocation;
  normalizeStored(location: PageLocation): ResolvedPageLocation;
  locationsEqual(left: PageLocation | undefined, right: PageLocation | undefined): boolean;
  commit(
    projectId: string,
    resolved: ResolvedPageLocation,
    history: "push" | "replace" | "none",
    action: string,
  ): WorkbenchPageNavigationResult;
  fail(source: WorkbenchPageLocationDiagnostic["source"], error: unknown): WorkbenchPageNavigationResult;
  closePlacement(identity: PlacementIdentity): WorkbenchPageNavigationResult;
  removeResource(resource: ResourceRef, retained: readonly PlacementIdentity[]): void;
  canGoBack(): boolean;
  canGoForward(): boolean;
  dispose(): void;
}

const hasResolvableCurrentPageUrl = <Value>(actions: PageLocationControllerActionsInput<Value>, projectId: string) => {
  try {
    return Boolean(actions.resolveUrl(projectId, actions.input.browser.current()));
  } catch {
    return false;
  }
};

export const createPageLocationControllerActions = <Value>(
  actions: PageLocationControllerActionsInput<Value>,
): WorkbenchPageLocationController => {
  const { input } = actions;
  return {
    historyStore: actions.historyStore,
    removeResource: actions.removeResource,
    setProject(projectId) {
      if (input.registry.store.getState().projectId === projectId) return;
      actions.clearProject(projectId);
      actions.resetHistory();
    },
    clearProject() {
      actions.clearProject(undefined);
      actions.resetHistory();
    },
    isCurrentProjectUrl: (projectId) => isWorkbenchProjectUrl(input.browser.current().url, projectId),
    hasCurrentPageUrl: (projectId) => hasResolvableCurrentPageUrl(actions, projectId),
    getBootLocation(projectId) {
      try {
        if (isWorkbenchProjectUrl(input.browser.current().url, projectId)) {
          return actions.resolveUrl(projectId, input.browser.current())?.location;
        }
        const saved = input.persistence.load(projectId);
        if (saved) return actions.normalizeStored(saved.location).location;
        return actions.normalizeTarget({ kind: "page", page: input.startPage }).location;
      } catch {
        return undefined;
      }
    },
    boot: (projectId) => actions.restore(projectId, "boot", true),
    switchProject(projectId) {
      actions.clearProject(projectId);
      return actions.restore(projectId, "project-switch", false);
    },
    navigate(target) {
      const projectId = input.registry.store.getState().projectId;
      if (!projectId) return actions.fail("navigation", new Error("Cannot navigate before a project is active"));
      try {
        const resolved = actions.normalizeTarget(target);
        const history = actions.locationsEqual(input.registry.store.getState().location, resolved.location)
          ? "none"
          : "push";
        return actions.commit(projectId, resolved, history, "navigatePageLocation");
      } catch (error) {
        return actions.fail("navigation", error);
      }
    },
    updateParams(patch) {
      const current = input.registry.store.getState();
      if (!current.location || !current.projectId) throw new Error("page_params_no_page");
      const page = input.registry.getPage(current.activePageId!);
      const values = { ...current.location.params };
      for (const [name, value] of Object.entries(patch)) {
        if (!page?.params || !Object.hasOwn(page.params, name)) throw new Error(`page_param_invalid: ${name}`);
        if (value === null) delete values[name];
        else values[name] = value;
      }
      const params = normalizePageParams(page?.params, values);
      const { params: previous, ...location } = current.location;
      const resolved = actions.normalizeStored({ ...location, ...(params ? { params } : {}) });
      if (actions.locationsEqual(current.location, resolved.location)) return current.location;
      const result = actions.commit(current.projectId, resolved, "replace", "updatePageParams");
      if (!result.ok) throw new Error(result.diagnostic.message);
      return result.location;
    },
    replay(location) {
      const projectId = input.registry.store.getState().projectId;
      if (!projectId) return actions.fail("history", new Error("Cannot replay a page before a project is active"));
      try {
        return actions.commit(projectId, actions.normalizeStored(location), "replace", "replayWorkbenchPageHistory");
      } catch (error) {
        return actions.fail("history", error);
      }
    },
    navigateToParent() {
      const current = input.registry.store.getState();
      if (!current.projectId || !current.location?.parent) {
        return actions.fail("navigation", new Error("The active page does not have a parent location"));
      }
      try {
        return actions.commit(
          current.projectId,
          actions.normalizeStored(current.location.parent),
          "replace",
          "navigateToParentPageLocation",
        );
      } catch (error) {
        return actions.fail("navigation", error);
      }
    },
    navigateToRootLevel() {
      const current = input.registry.store.getState();
      if (!current.projectId) {
        return actions.fail("navigation", new Error("Cannot navigate before a project is active"));
      }
      try {
        const resolved = actions.rootLevelTarget();
        const history = actions.locationsEqual(current.location, resolved.location) ? "none" : "push";
        return actions.commit(current.projectId, resolved, history, "navigateToRootLevelPageLocation");
      } catch (error) {
        return actions.fail("navigation", error);
      }
    },
    closePlacement: actions.closePlacement,
    goBack() {
      if (actions.canGoBack()) input.browser.back();
    },
    goForward() {
      if (actions.canGoForward()) input.browser.forward();
    },
    dispose: actions.dispose,
  };
};
