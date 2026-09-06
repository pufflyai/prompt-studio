import type { NavigationTargetPage, PageLocation, PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchStore } from "../../shared/store/workbench-store";
import { isWorkbenchProjectUrl } from "./page-location-codec";
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
