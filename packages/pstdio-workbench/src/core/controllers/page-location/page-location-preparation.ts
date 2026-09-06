import type { NavigationTargetPage } from "@pstdio/sdk/extensions";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import type {
  ResolvedPageLocation,
  WorkbenchPageLocationController,
  WorkbenchPageNavigationResult,
} from "./page-location-types";

interface PageLocationPreparation<Value> {
  resolve(target: NavigationTargetPage): ResolvedPageLocation;
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
