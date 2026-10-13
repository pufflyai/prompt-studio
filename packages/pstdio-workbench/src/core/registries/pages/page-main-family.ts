import { contributionRefId } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution } from "./page-registry-types";

// Related pages can rebind one Main view without sharing their logical layout owner.
export const pageMainFamily = (
  page: WorkbenchPageContribution,
  pages: Readonly<Record<string, WorkbenchPageContribution>>,
) => {
  if (page.main.kind !== "view" || page.main.cardinality !== "one") return undefined;
  const viewId = contributionRefId(page.main.view);
  let root = page;
  const visited = new Set([root.id]);
  while (root.parentId) {
    const parent = pages[root.parentId];
    if (
      !parent ||
      visited.has(parent.id) ||
      parent.main.kind !== "view" ||
      parent.main.cardinality !== "one" ||
      contributionRefId(parent.main.view) !== viewId
    )
      break;
    visited.add(parent.id);
    root = parent;
  }
  return root.id;
};
