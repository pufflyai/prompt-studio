import type { LayoutModel } from "../../registries/layout/layout-model";
import { findPlacementByWidgetId, getActiveLocationPlacement } from "../../registries/layout/layout-operations";
import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import { workbenchPanelRegions } from "../../registries/layout/layout-types";
import { matchesWorkbenchLocationEligibility } from "../../registries/layout/panel-widget-eligibility";
import type { WorkbenchModeRegistry } from "../../registries/modes/mode-registry";
import type { WorkbenchLocationRef, WorkbenchNavigationEntry, WorkbenchSubPanelRef } from "./history-types";

export const workbenchNavigationPanelRegions = ["main", "secondary"] as const;

export const workbenchPlacementRole = (layout: LayoutModel, placement: WorkbenchWidgetPlacement) =>
  placement.role ?? layout.getWidget(placement.contributionId)?.role ?? "content";

export const findSubPanelPlacement = (layout: LayoutModel, reference: WorkbenchSubPanelRef) => {
  if (reference.instanceKey) {
    const exact = findPlacementByWidgetId(layout.getLayout(), reference.instanceKey)?.placement;
    if (exact) return exact;
  }
  for (const region of workbenchPanelRegions) {
    const placement = layout
      .getLayout()
      .regions[region].widgets.find(
        (candidate) =>
          candidate.contributionId === reference.contributionId && candidate.resourceUri === reference.resourceUri,
      );
    if (placement) return placement;
  }
  return undefined;
};

export const subPanelRefFromPlacement = (placement: WorkbenchWidgetPlacement): WorkbenchSubPanelRef => ({
  contributionId: placement.contributionId,
  resourceUri: placement.resourceUri,
  instanceKey: placement.widgetId,
});

const isSameSubPanel = (left: WorkbenchSubPanelRef | undefined, right: WorkbenchSubPanelRef | undefined) =>
  left?.contributionId === right?.contributionId &&
  left?.resourceUri === right?.resourceUri &&
  left?.instanceKey === right?.instanceKey;

export const selectedSubPanelsFromLayout = (layout: LayoutModel, modeId: string | undefined) => {
  const selected: Partial<Record<(typeof workbenchNavigationPanelRegions)[number], WorkbenchSubPanelRef>> = {};
  const location = getActiveLocationPlacement(layout.getLayout());
  for (const regionId of workbenchNavigationPanelRegions) {
    const region = layout.getLayout().regions[regionId];
    const active = region.widgets.find((placement) => placement.widgetId === region.activeWidgetId);
    const widget = active ? layout.getWidget(active.contributionId) : undefined;
    if (
      active &&
      widget &&
      workbenchPlacementRole(layout, active) === "sub-panel" &&
      matchesWorkbenchLocationEligibility(widget, location?.resource, modeId, active)
    ) {
      selected[regionId] = subPanelRefFromPlacement(active);
    }
  }
  return selected;
};

const locationPlacementFromLayout = (layout: LayoutModel) => {
  const activeLocation = getActiveLocationPlacement(layout.getLayout());
  if (activeLocation) return activeLocation;
  const region = layout.getLayout().regions.main;
  const active = region.widgets.find((placement) => placement.widgetId === region.activeWidgetId);
  if (active && workbenchPlacementRole(layout, active) !== "sub-panel") return active;
  return (
    region.widgets.find((placement) => workbenchPlacementRole(layout, placement) === "location") ??
    region.widgets.find((placement) => workbenchPlacementRole(layout, placement) !== "sub-panel")
  );
};

const locationFromPlacement = (
  placement: WorkbenchWidgetPlacement,
  modeId: string | undefined,
): WorkbenchLocationRef => ({
  key: placement.resourceUri
    ? `${modeId ?? "global"}:resource:${placement.resourceUri}`
    : `${modeId ?? "global"}:widget:${placement.contributionId}:${placement.widgetId}`,
  modeId,
  resource: placement.resource,
  contributionId: placement.contributionId,
  instanceKey: placement.widgetId,
  title: placement.title,
});

export const entryFromCurrentSnapshot = (input: {
  counter: number;
  layout: LayoutModel;
  modes?: Pick<WorkbenchModeRegistry, "getActiveModeId" | "getMode">;
}): WorkbenchNavigationEntry | undefined => {
  const modeId = input.modes?.getActiveModeId();
  const placement = locationPlacementFromLayout(input.layout);
  const recordedAt = Date.now();
  const base = {
    entryId: `history-${recordedAt}-${input.counter}`,
    recordedAt,
    selectedSubPanels: selectedSubPanelsFromLayout(input.layout, modeId),
  };

  if (placement) {
    return {
      ...base,
      location: locationFromPlacement(placement, modeId),
      kind: placement.resource ? "resource" : "widget",
      modeId,
      resource: placement.resource,
      widgetId: placement.widgetId,
      contributionId: placement.contributionId,
      title: placement.title,
    };
  }
  if (!modeId) return undefined;
  return {
    ...base,
    location: { key: `mode:${modeId}`, modeId, title: input.modes?.getMode(modeId)?.label ?? modeId },
    kind: "mode",
    modeId,
    title: input.modes?.getMode(modeId)?.label ?? modeId,
  };
};

export const isSameNavigationEntry = (
  left: WorkbenchNavigationEntry | undefined,
  right: WorkbenchNavigationEntry | undefined,
) => {
  if (!left || !right || left.location.key !== right.location.key) return false;
  return workbenchNavigationPanelRegions.every((region) =>
    isSameSubPanel(left.selectedSubPanels[region], right.selectedSubPanels[region]),
  );
};

export const compactNavigationEntries = (entries: readonly WorkbenchNavigationEntry[]) => {
  const compacted: WorkbenchNavigationEntry[] = [];
  for (const entry of entries) {
    const lastIndex = compacted.length - 1;
    if (isSameNavigationEntry(compacted[lastIndex], entry)) compacted[lastIndex] = entry;
    else compacted.push(entry);
  }
  return compacted;
};

export const withoutSubPanelSelection = (entry: WorkbenchNavigationEntry, placement: WorkbenchWidgetPlacement) => {
  const selectedSubPanels = { ...entry.selectedSubPanels };
  for (const region of workbenchPanelRegions) {
    const selected = selectedSubPanels[region];
    if (
      selected?.instanceKey === placement.widgetId ||
      (selected?.contributionId === placement.contributionId && selected.resourceUri === placement.resourceUri)
    ) {
      delete selectedSubPanels[region];
    }
  }
  return { ...entry, selectedSubPanels };
};

export const closedNavigationEntry = (input: {
  counter: number;
  current?: WorkbenchNavigationEntry;
  closedSubPanel?: WorkbenchNavigationEntry["closedSubPanel"];
  modeId?: string;
  placement: WorkbenchWidgetPlacement;
}) => {
  const { closedSubPanel, counter, current, modeId, placement } = input;
  const recordedAt = Date.now();
  if (current) {
    return {
      ...current,
      entryId: `history-${recordedAt}-${counter}`,
      recordedAt,
      closedSubPanel,
    } satisfies WorkbenchNavigationEntry;
  }
  return {
    entryId: `history-${recordedAt}-${counter}`,
    recordedAt,
    location: {
      key: placement.resourceUri
        ? `${modeId ?? "global"}:resource:${placement.resourceUri}`
        : `${modeId ?? "global"}:widget:${placement.contributionId}:${placement.widgetId}`,
      modeId,
      resource: placement.resource,
      contributionId: placement.contributionId,
      instanceKey: placement.widgetId,
      title: placement.title,
    },
    selectedSubPanels: {},
    kind: placement.resource ? "resource" : "widget",
    modeId,
    resource: placement.resource,
    widgetId: placement.widgetId,
    contributionId: placement.contributionId,
    title: placement.title,
    closedSubPanel,
  } satisfies WorkbenchNavigationEntry;
};
