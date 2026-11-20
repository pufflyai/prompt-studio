import type { NavigationTarget } from "@pstdio/sdk/extensions";

/** Planner's resource references preview beside the ticket, including legacy compound openers. */
export const resourceLinkTarget = (target: NavigationTarget): NavigationTarget => {
  const preview = (item: Extract<NavigationTarget, { kind: "page" | "panel" }>) => {
    const { open: _open, ...target } = item;
    return { ...target, region: "side" as const, ...(item.kind === "page" ? { open: "preview" as const } : {}) };
  };
  if (target.kind === "compound") {
    const resources = target.targets.filter((item) => item.resource);
    if (resources.length > 1)
      return { ...target, targets: resources.map((item) => ({ ...item, region: "side" as const })) };
    return resources.length ? { ...target, targets: resources.map(preview) } : target;
  }
  return (target.kind === "page" || target.kind === "panel") && target.resource ? preview(target) : target;
};
