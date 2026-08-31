import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import { dockedCompositionRegions } from "./composition-resolver-types";
import { activateInLayout, findPlacementByWidgetId, removeLocationSubPanelSelection } from "./layout-operations";
import {
  type WorkbenchLayout,
  type WorkbenchRegion,
  type WorkbenchWidgetPlacement,
  workbenchRegions,
} from "./layout-types";
import { composeOwnedPlacements, placementIdentityKey, type ResolvedOwnedPlacement } from "./placement-reconciliation";

export type WorkbenchOwnedWidgetPlacement = ResolvedOwnedPlacement<WorkbenchWidgetPlacement>;

export interface ReconcileOwnedWidgetLayoutInput {
  layout: WorkbenchLayout;
  placements: readonly WorkbenchOwnedWidgetPlacement[];
  activate?: readonly PlacementIdentity[];
}

interface RenderedOwnedPlacement {
  identity: PlacementIdentity;
  region: WorkbenchOwnedWidgetPlacement["region"];
  placement: WorkbenchWidgetPlacement;
}

const indexCurrentOwnedPlacements = (layout: WorkbenchLayout) => {
  const indexed = new Map<string, { region: WorkbenchRegion; placement: WorkbenchWidgetPlacement }>();
  for (const region of Object.values(layout.regions)) {
    for (const placement of region.widgets) {
      if (!placement.placementIdentity) continue;
      const key = placementIdentityKey(placement.placementIdentity);
      if (indexed.has(key)) throw new Error(`Duplicate rendered placement identity: ${key}`);
      indexed.set(key, { region: region.id, placement });
    }
  }
  return indexed;
};

const renderDesiredPlacements = (
  input: ReconcileOwnedWidgetLayoutInput,
  current: ReturnType<typeof indexCurrentOwnedPlacements>,
) => {
  const rendered: RenderedOwnedPlacement[] = [];
  const identities = new Set<string>();
  const currentWidgetOwners = new Map<string, string | null>();
  for (const region of Object.values(input.layout.regions)) {
    for (const placement of region.widgets) {
      if (currentWidgetOwners.has(placement.widgetId)) {
        throw new Error(`Duplicate rendered widget ID: ${placement.widgetId}`);
      }
      currentWidgetOwners.set(
        placement.widgetId,
        placement.placementIdentity ? placementIdentityKey(placement.placementIdentity) : null,
      );
    }
  }
  const desiredWidgetIds = new Set<string>();

  const ordered = composeOwnedPlacements({
    shell: input.placements.filter((placement) => placement.identity.kind === "shell"),
    mode: input.placements.filter((placement) => placement.identity.kind === "mode"),
    page: input.placements.filter((placement) => placement.identity.kind === "page"),
  }).placements;
  for (const desired of ordered) {
    const key = placementIdentityKey(desired.identity);
    if (identities.has(key)) throw new Error(`Duplicate desired placement identity: ${key}`);
    identities.add(key);
    const widgetId = current.get(key)?.placement.widgetId ?? desired.value.widgetId;
    if (currentWidgetOwners.has(widgetId) && currentWidgetOwners.get(widgetId) !== key) {
      throw new Error(`Rendered widget ID belongs to another placement: ${widgetId}`);
    }
    if (desiredWidgetIds.has(widgetId)) throw new Error(`Duplicate desired widget ID: ${widgetId}`);
    desiredWidgetIds.add(widgetId);
    rendered.push({
      identity: desired.identity,
      region: desired.region,
      placement: { ...desired.value, widgetId, placementIdentity: desired.identity },
    });
  }
  return rendered;
};

const reconcileRegions = (layout: WorkbenchLayout, desired: readonly RenderedOwnedPlacement[]) => {
  const docked = new Set<WorkbenchRegion>(dockedCompositionRegions);
  const regions = { ...layout.regions };
  for (const regionId of workbenchRegions) {
    const region = layout.regions[regionId];
    const foreign = region.widgets.filter((placement) => !placement.placementIdentity);
    const owned = desired.filter((placement) => placement.region === regionId).map((entry) => entry.placement);
    const widgets = docked.has(regionId) ? [...foreign, ...owned] : foreign;
    const activeWidgetId = widgets.some((placement) => placement.widgetId === region.activeWidgetId)
      ? region.activeWidgetId
      : widgets[0]?.widgetId;
    regions[regionId] = {
      ...region,
      widgets,
      activeWidgetId,
      ...(docked.has(regionId) ? { visible: widgets.length > 0 } : {}),
    };
  }
  return { ...layout, regions };
};

const normalizeRemovedState = (input: {
  current: ReturnType<typeof indexCurrentOwnedPlacements>;
  desired: readonly RenderedOwnedPlacement[];
  layout: WorkbenchLayout;
}) => {
  const desiredKeys = new Set(input.desired.map((placement) => placementIdentityKey(placement.identity)));
  let layout = input.layout;
  for (const [key, current] of input.current) {
    if (!desiredKeys.has(key)) layout = removeLocationSubPanelSelection(layout, current.placement.widgetId);
  }

  const activeLocation = layout.activeLocationWidgetId
    ? findPlacementByWidgetId(layout, layout.activeLocationWidgetId)?.placement
    : undefined;
  const fallbackLocation = layout.regions.main.widgets.filter((placement) => placement.role === "location").at(-1);
  const activeLocationWidgetId = activeLocation?.widgetId ?? fallbackLocation?.widgetId;
  const active = layout.activeWidgetId ? findPlacementByWidgetId(layout, layout.activeWidgetId)?.placement : undefined;
  const fallbackActive = activeLocationWidgetId
    ? findPlacementByWidgetId(layout, activeLocationWidgetId)?.placement
    : Object.values(layout.regions).flatMap((region) => region.widgets)[0];

  return {
    ...layout,
    activeWidgetId: active?.widgetId ?? fallbackActive?.widgetId,
    activeLocationWidgetId,
    activeResourceUri: active?.resourceUri ?? fallbackActive?.resourceUri,
  };
};

export const reconcileOwnedWidgetLayout = (input: ReconcileOwnedWidgetLayoutInput) => {
  const current = indexCurrentOwnedPlacements(input.layout);
  const desired = renderDesiredPlacements(input, current);
  let layout: WorkbenchLayout = normalizeRemovedState({
    current,
    desired,
    layout: reconcileRegions(input.layout, desired),
  });
  const desiredByIdentity = new Map(desired.map((entry) => [placementIdentityKey(entry.identity), entry]));

  for (const identity of input.activate ?? []) {
    const entry = desiredByIdentity.get(placementIdentityKey(identity));
    if (!entry) throw new Error(`Cannot activate missing rendered placement: ${placementIdentityKey(identity)}`);
    layout = activateInLayout(layout, entry.region, entry.placement);
  }
  return layout;
};
