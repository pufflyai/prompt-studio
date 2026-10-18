import { resourceKey } from "@pstdio/sdk/extensions";
import type { WorkbenchLayout, WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { placementIdentityKey } from "../../registries/layout/placement-reconciliation";
import { requirePageSlot } from "../../registries/pages/page-main";
import type { WorkbenchPageRegistryStoreState, WorkbenchPageResourceCodec } from "../../registries/pages/page-registry";
import { closePageSlot } from "../../registries/pages/page-slot-lifecycle";
import { pageStateKey } from "../../registries/pages/page-state-key";
import { removeTrayPreviews } from "./tray-preview-retention";

type State = WorkbenchPageRegistryStoreState<WorkbenchWidgetPlacement>;

export const departingPagePreviews = (next: State, previous: State, layout: WorkbenchLayout) => {
  if (
    !previous.activePageId ||
    previous.projectId !== next.projectId ||
    previous.activeModeId !== next.activeModeId ||
    (previous.activePageId === next.activePageId &&
      resourceKey(previous.location?.resource) === resourceKey(next.location?.resource))
  )
    return [];
  return Object.values(layout.regions).flatMap((region) =>
    region.widgets.filter((widget) => widget.tabRetention === "preview"),
  );
};

export const closeDepartingPagePreviews = (
  state: State,
  previous: State,
  layout: WorkbenchLayout,
  resources: WorkbenchPageResourceCodec,
) => {
  const previews = departingPagePreviews(state, previous, layout);
  const removed = new Set(
    previews.flatMap((widget) => {
      if (!widget.placementIdentity) return [];
      const key = placementIdentityKey(widget.placementIdentity);
      const incoming = state.placements.find((entry) => placementIdentityKey(entry.identity) === key);
      return incoming?.value.tabRetention === "preview" &&
        resourceKey(incoming.value.resource) === resourceKey(widget.resource)
        ? [key]
        : [];
    }),
  );
  const next = removeTrayPreviews(state, previous, resources, removed);
  const pageStates = { ...next.pageStates };
  for (const widget of previews) {
    const identity = widget.placementIdentity;
    if (identity?.kind !== "page") continue;
    const page = previous.pages[identity.pageId]!;
    const key = pageStateKey(page, previous.location, resources);
    const current = pageStates[key];
    if (!current) continue;
    const result = closePageSlot({
      page,
      slot: requirePageSlot(page, identity.slotId),
      state: current,
      instanceKey: identity.instanceKey,
    });
    pageStates[key] =
      result.kind === "parent" ? { ...result.state, activePrimaryInstanceKey: undefined } : result.state;
  }
  return previews.length ? { ...next, pageStates } : next;
};
