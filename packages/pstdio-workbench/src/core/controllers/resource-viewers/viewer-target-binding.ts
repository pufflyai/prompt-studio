import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { NavigationTargetPage, NavigationTargetPanel } from "../../registries/navigation/navigation-registry";
import { pageSlots } from "../../registries/pages/page-main";
import type { WorkbenchPageRegistryStoreState } from "../../registries/pages/page-registry";
import type { WorkbenchCore } from "../../workbench-core-types";

/** A link's omitted owner comes from its target declaration, never the order extensions arrive. */
export const viewerTargetBinding = (
  core: WorkbenchCore,
  target: NavigationTargetPage | NavigationTargetPanel,
  state: WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement> = core.pages.store.getState(),
) => {
  if (target.kind === "page")
    return Object.values(state.pages).find(
      (page) => page.ref.id === target.page.id && page.ref.extensionId === target.page.extensionId,
    )?.resource;
  const ref = target.panel;
  if (ref.kind === "placement") {
    const item = core.modePlacements.getPlacement(ref)?.item;
    return item?.kind === "binding" ? item.binding : undefined;
  }
  if (ref.kind === "shell-placement") {
    const item = core.shellPlacements.getPlacement(ref.id)?.item;
    return item?.kind === "binding" ? item.binding : undefined;
  }
  const page = Object.values(state.pages).find(
    (page) => page.ref.id === ref.page.id && page.ref.extensionId === ref.page.extensionId,
  );
  const item = page && pageSlots(page).find((slot) => slot.id === ref.id)?.item;
  return item?.kind === "binding" ? item.binding : undefined;
};
