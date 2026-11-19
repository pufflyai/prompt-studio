import type { NavigationTarget, NavigationTargetPage, NavigationTargetPanel } from "./types/navigation-target";

/** Resource references preview beside the source. Explicit destination and pin actions use ordinary navigation. */
export const resourceLinkTarget = (target: NavigationTarget): NavigationTarget => {
  const preview = (item: NavigationTargetPage | NavigationTargetPanel) => {
    if (!item.resource) return item;
    const { open: _open, ...target } = item;
    // Many-resource panel bindings default to preview. Single-instance bindings have no open intent.
    return { ...target, region: "side" as const, ...(item.kind === "page" ? { open: "preview" as const } : {}) };
  };
  if (target.kind === "compound") {
    // A legacy compound may name a containing page before its resource panel.
    // The reference opens the resource without entering that containing page.
    const resources = target.targets.filter((item) => item.resource);
    if (resources.length > 1)
      return { ...target, targets: resources.map((item) => ({ ...item, region: "side" as const })) };
    return resources.length ? { ...target, targets: resources.map(preview) } : target;
  }
  return target.kind === "page" || target.kind === "panel" ? preview(target) : target;
};
