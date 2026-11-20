import type { NavigationTarget, NavigationTargetPage, NavigationTargetPanel } from "./types/navigation-target";

/** The panel showing the reference a person followed, when the caller knows it. */
export interface ResourceLinkSource {
  region?: NavigationTargetPage["region"];
}

/** Resource references preview beside the source. Explicit destination and pin actions use ordinary navigation. */
export const resourceLinkTarget = (target: NavigationTarget, source?: ResourceLinkSource): NavigationTarget => {
  // A page preview in Side would cover a Side source, so a page followed from Side opens in Main.
  // Panel targets keep Side: Main does not accept panels in every mode.
  const pageRegion = source?.region === "side" ? "main" : "side";
  const preview = (
    item: NavigationTargetPage | NavigationTargetPanel,
  ): NavigationTargetPage | NavigationTargetPanel => {
    if (!item.resource) return item;
    const { open: _open, ...target } = item;
    // Many-resource panel bindings default to preview. Single-instance bindings have no open intent.
    if (target.kind === "panel") return { ...target, region: "side" };
    // Main navigates ordinarily; an unpinned preview is a Side tab.
    return pageRegion === "side" ? { ...target, region: "side", open: "preview" } : { ...target, region: "main" };
  };
  if (target.kind === "compound") {
    // A legacy compound may name a containing page before its resource panel.
    // The reference opens the resource without entering that containing page.
    const resources = target.targets.filter((item) => item.resource);
    if (resources.length > 1)
      return {
        ...target,
        targets: resources.map((item) => ({ ...item, region: item.kind === "page" ? pageRegion : "side" })),
      };
    return resources.length ? { ...target, targets: resources.map(preview) } : target;
  }
  return target.kind === "page" || target.kind === "panel" ? preview(target) : target;
};
