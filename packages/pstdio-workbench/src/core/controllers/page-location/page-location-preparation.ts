import type { NavigationTargetPage, PageLocation } from "@pstdio/sdk/extensions";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import type {
  ResolvedPageLocation,
  WorkbenchPageLocationController,
  WorkbenchPageNavigationResult,
} from "./page-location-types";

interface PageLocationPreparation<Value> {
  resolve(target: NavigationTargetPage, activeModeId?: string): ResolvedPageLocation;
  commit(state: WorkbenchPageRegistryStoreState<Value>, beforePublish?: () => void): WorkbenchPageNavigationResult;
}
const preparations = new WeakMap<WorkbenchPageLocationController, PageLocationPreparation<unknown>>();
export const setPageLocationPreparation = <Value>(
  controller: WorkbenchPageLocationController,
  preparation: PageLocationPreparation<Value>,
) => preparations.set(controller, preparation as PageLocationPreparation<unknown>);
export const getPageLocationPreparation = <Value>(controller: WorkbenchPageLocationController) => {
  const preparation = preparations.get(controller);
  if (!preparation) throw new Error("Page location preparation is unavailable");
  return preparation as PageLocationPreparation<Value>;
};

export const createPreparedPageLocationCommit =
  <Value>(input: {
    currentLocation(): PageLocation | undefined;
    locationsEqual(left: PageLocation | undefined, right: PageLocation | undefined): boolean;
    publish(
      projectId: string,
      state: WorkbenchPageRegistryStoreState<Value>,
      history: "push" | "none",
      action: string,
      beforePublish?: () => void,
    ): WorkbenchPageNavigationResult;
  }) =>
  (state: WorkbenchPageRegistryStoreState<Value>, beforePublish?: () => void) => {
    if (!state.projectId || !state.location) throw new Error("Cannot navigate before a project is active");
    const history = input.locationsEqual(input.currentLocation(), state.location) ? "none" : "push";
    return input.publish(state.projectId, state, history, "navigateCompoundTarget", beforePublish);
  };
