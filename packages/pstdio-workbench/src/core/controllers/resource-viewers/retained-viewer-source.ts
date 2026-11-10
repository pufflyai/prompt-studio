import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import type { WorkbenchCore } from "../../workbench-core-types";

/** Pinned page viewers keep their authority while their page's layout is cached. */
export const retainedViewerSource = (core: WorkbenchCore, identity: PlacementIdentity) => {
  if (identity.kind !== "page") return undefined;
  return Object.entries(core.pages.store.getState().pageStates)
    .filter(([key]) => key === identity.pageId || key.startsWith(`${identity.pageId}|`))
    .flatMap(([, page]) => page.resourceInstances[identity.slotId] ?? [])
    .find((entry) => entry.instanceKey === identity.instanceKey);
};
