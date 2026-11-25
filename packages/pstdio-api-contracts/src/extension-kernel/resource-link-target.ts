import type { NavigationTarget, NavigationTargetPage, NavigationTargetPanel } from "./types/navigation-target";

/** @deprecated Navigation tracks the viewer that followed a link through its invocation context. */
export interface ResourceLinkSource {
  region?: NavigationTargetPage["region"];
}

const previewsInSide = (target: NavigationTargetPage | NavigationTargetPanel) =>
  Boolean(target.resource && !target.region && !target.open);

/** Return the registered opening when Side was chosen implicitly and can't display the link. */
export const resourceLinkFallback = (target: NavigationTarget): NavigationTarget | undefined => {
  if (target.kind === "compound") return target.targets.some(previewsInSide) ? target : undefined;
  if ((target.kind === "page" || target.kind === "panel") && previewsInSide(target)) return target;
};

/** Follow a reference beside its source. A caller may supply an explicit destination on the target. */
export const resourceLinkTarget = (target: NavigationTarget, _source?: ResourceLinkSource): NavigationTarget => {
  const preview = (
    item: NavigationTargetPage | NavigationTargetPanel,
  ): NavigationTargetPage | NavigationTargetPanel => {
    if (!item.resource || (item.region && item.region !== "side")) return item;
    if (item.kind === "panel") {
      const { open, ...panel } = item;
      return { ...panel, region: "side", ...(open === "pin" ? { open } : {}) };
    }
    return { ...item, region: "side", open: item.open ?? "preview" };
  };
  if (target.kind === "compound") {
    const resources = target.targets.filter((item) => item.resource);
    return resources.length ? { ...target, targets: resources.map(preview) } : target;
  }
  return target.kind === "page" || target.kind === "panel" ? preview(target) : target;
};
