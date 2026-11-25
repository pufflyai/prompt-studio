import type { NavigationTarget, NavigationTargetPage, NavigationTargetPanel } from "@pstdio/sdk/extensions";

/** Follow a reference beside its source. A caller may supply an explicit destination on the target. */
export const resourceLinkTarget = (target: NavigationTarget): NavigationTarget => {
  const preview = (
    item: NavigationTargetPage | NavigationTargetPanel,
  ): NavigationTargetPage | NavigationTargetPanel => {
    if (!item.resource || (item.region && item.region !== "side")) return item;
    if (item.kind === "panel") return { ...item, region: "side" };
    return { ...item, region: "side", open: item.open ?? "preview" };
  };
  if (target.kind === "compound") {
    const resources = target.targets.filter((item) => item.resource);
    return resources.length ? { ...target, targets: resources.map(preview) } : target;
  }
  return target.kind === "page" || target.kind === "panel" ? preview(target) : target;
};
