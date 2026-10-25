import type { NavigationTargetPage } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry";
import { pageLocationTarget } from "./page-location-target";
import type { ResolvedPageLocation } from "./page-location-types";

/** Resolve only the active entry. Groups in its parent chain remain navigation context. */
export const resolvePageGroupDefault = <Resolved extends ResolvedPageLocation>(
  initial: Resolved,
  pages: readonly WorkbenchPageContribution[],
  normalize: (target: NavigationTargetPage) => Resolved,
) => {
  let resolved = initial;
  const seen = new Set<string>();
  for (;;) {
    const page = pages.find((page) => page.id === resolved.pageId);
    if (page?.main.kind !== "group") return resolved;
    if (seen.has(page.id)) throw new Error(`Page group default cycle reaches ${page.id}`);
    seen.add(page.id);
    const ref = page.main.default;
    const child = pages.find(
      (candidate) => candidate.ref.id === ref.id && candidate.ref.extensionId === ref.extensionId,
    );
    if (!child || child.parentId !== page.id || child.modeId !== page.modeId || child.resource)
      throw new Error(`Page group "${page.id}" requires an available default child in its mode without a resource`);
    if (resolved.location.resource || resolved.open)
      throw new Error(`Page group "${page.id}" does not accept a resource or open intent`);
    resolved = normalize({ kind: "page", page: ref, parent: pageLocationTarget(resolved.location) });
  }
};
