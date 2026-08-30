import type { WorkbenchPageContribution, WorkbenchPageSlot } from "../../registries/pages/page-registry";
import type { ResourceRef } from "../../registries/resources/resource-registry";

// How a page composition reads the bench, as pure functions over the layout: which
// widgets a slot owns, which of them the page may take back, how a location change
// should be recorded, and which resource the page's Location is showing. The
// controller owns the state; these decide the shape.

export interface PageLayoutPlacement {
  widgetId: string;
  contributionId: string;
  resourceUri?: string;
  resource?: ResourceRef;
  role?: string;
}

export interface PageLayoutApi {
  getLayout: () => {
    regions: Record<string, { widgets: PageLayoutPlacement[] } | undefined>;
    activeWidgetId?: string;
    activeLocationWidgetId?: string;
  };
  getPanel: (id: string) => unknown;
  closePanel: (instanceId: string) => unknown;
}

export const bySlotOrder = (left: WorkbenchPageSlot, right: WorkbenchPageSlot) => left.order - right.order;

export const boundKindsForSlot = (page: WorkbenchPageContribution, slot: WorkbenchPageSlot) =>
  new Set(page.bindings.filter((binding) => binding.slot === slot.id).map((binding) => binding.kind));

export const slotInstancesIn = (
  layout: PageLayoutApi,
  page: WorkbenchPageContribution,
  slot: WorkbenchPageSlot,
): PageLayoutPlacement[] => {
  const region = layout.getLayout().regions[slot.region];
  if (!region) return [];
  if (slot.panelId) {
    return region.widgets.filter((widget) => widget.contributionId === slot.panelId);
  }
  const kinds = boundKindsForSlot(page, slot);
  return region.widgets.filter((widget) => widget.resource && kinds.has(widget.resource.kind));
};

export const shouldOpenStaticSlot = (
  layout: PageLayoutApi,
  page: WorkbenchPageContribution,
  slot: WorkbenchPageSlot,
  seed: boolean,
) => {
  if (!slot.panelId) return false;
  if (seed) return slot.defaultOpen;
  // On a restored arrangement, closable slots the user closed stay closed and
  // already-open slots are left alone; unclosable slots must always exist.
  if (slotInstancesIn(layout, page, slot).length > 0) return false;
  return !slot.closable;
};

// Pages own only widgets they could have placed: Locations and Sub Panels. Chrome
// (role "content", e.g. the host sidenav tree) is workbench structure that composes
// alongside page slots — the same rule the mode registry and scope carry use.
export const isPageOwnableWidget = (widget: PageLayoutPlacement) =>
  widget.role === "location" || widget.role === "sub-panel";

// Composing a region drops page-ownable widgets that no slot of this page owns:
// on seed everything goes (a fresh arrangement), on reconcile the user's open/closed
// choices stay and only stale bound tabs drop — they are session state, and only the
// active location returns, through the URL or history.
export const dropForeignWidgets = (
  layout: PageLayoutApi,
  page: WorkbenchPageContribution,
  region: string,
  seed: boolean,
) => {
  const state = layout.getLayout().regions[region];
  const owned = seed
    ? new Set<string>()
    : new Set(
        page.slots
          .filter((slot) => slot.region === region)
          .flatMap((slot) => slotInstancesIn(layout, page, slot).map((widget) => widget.widgetId)),
      );
  for (const widget of state?.widgets ?? []) {
    if (isPageOwnableWidget(widget) && !owned.has(widget.widgetId)) layout.closePanel(widget.widgetId);
  }
};

// A preview replaces the entry it swaps out, so it may only replace when the page was
// already showing a resource. The page's own bare location — the board before a ticket
// is open — is a place of its own: the first resource has to push, or going back from
// the resource skips the page it came from.
export const locationChangeReason = (open: "preview" | "pin" | undefined, currentResourceUri: string | undefined) => {
  if (open === "pin") return "pin" as const;
  return currentResourceUri ? ("preview" as const) : ("activate" as const);
};

// A host page has no slots: it composes through its own presenters, so its location
// resource is the Location the bench is showing, as long as the page publishes that
// kind. Without this the sessions and workspaces pages would report a bare page
// location and the URL would drop the open resource.
//
// It follows the active Location, never the focused widget: selecting a Sub Panel, a
// terminal, or the sidenav moves `activeWidgetId` away from the Location while the
// bench still shows the same resource, and reading that would blank the URL.
export const activeHostResource = (layout: PageLayoutApi, page: WorkbenchPageContribution) => {
  const current = layout.getLayout();
  const locations = (current.regions.main?.widgets ?? []).filter((widget) => widget.role === "location");
  const active = locations.find((widget) => widget.widgetId === current.activeLocationWidgetId) ?? locations.at(-1);
  if (!active?.resource) return undefined;
  return page.binds.includes(active.resource.kind) ? active.resource : undefined;
};

// The page's location resource is what the Location shows, not whatever a follower
// still has open: closing the last bound tab in `main` returns the location to the
// bare page even while a sidenav tree lingers on the resource that just went away.
export const activeLocationResource = (
  layout: PageLayoutApi,
  page: WorkbenchPageContribution,
): ResourceRef | undefined => {
  if (page.activate) return activeHostResource(layout, page);
  const current = layout.getLayout();
  const boundSlots = page.slots.filter((slot) => !slot.panelId);
  for (const slot of boundSlots) {
    const active = slotInstancesIn(layout, page, slot).find((widget) => widget.widgetId === current.activeWidgetId);
    if (active?.resource) return active.resource;
  }
  for (const slot of boundSlots) {
    if (slot.region !== "main") continue;
    const instance = slotInstancesIn(layout, page, slot)[0];
    if (instance?.resource) return instance.resource;
  }
  return undefined;
};
