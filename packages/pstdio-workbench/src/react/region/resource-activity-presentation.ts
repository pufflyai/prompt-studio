import type { ResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution } from "../../core";
import { resourceMatchesConstraint } from "../../core/shared/contributions/reference-id";

// A document selector changes the presented file, not the resource's Activity identity.
// Navigation trees also carry their owner's resource but do not present its discussion.
export const presentsResourceActivity = (
  resource: ResourceRef | undefined,
  viewKind: string | undefined,
  pages: readonly WorkbenchPageContribution[],
  viewId: string | undefined,
  resolveViewId: (ref: import("@pstdio/sdk/extensions").ViewRef) => string | undefined,
) => {
  if (!resource || viewKind === "tree") return false;
  const documentPages = pages.filter(
    (page) => page.document && page.resource && resourceMatchesConstraint(page.resource, resource),
  );
  if (!documentPages.length) return true;
  return documentPages.some((page) => {
    if (page.main.kind !== "view" || resolveViewId(page.main.view) !== viewId) return false;
    if (!page.document) return false;
    const selected = resource.metadata?.[page.document.metadataKey];
    return typeof selected !== "string" || selected.length === 0;
  });
};
