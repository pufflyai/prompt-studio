import type { WorkbenchPageContribution } from "../../registries/pages/page-registry-types";

// Resource-free panel collections own one tray across their detail routes.
// Resource parents remain boundaries because each has its own content context.
export const collectionMainOwner = (
  page: WorkbenchPageContribution | undefined,
  pages: readonly WorkbenchPageContribution[],
) => {
  if (!page || page.main.kind === "panels") return page;
  let current = page;
  while (current.parentId) {
    const parent = pages.find((candidate) => candidate.id === current.parentId);
    if (!parent || parent.modeId !== page.modeId || parent.resource) break;
    if (parent.main.kind === "panels") return parent;
    current = parent;
  }
  return page;
};
