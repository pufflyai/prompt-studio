import type { ContributionSource, RegisteredContributionMetadata } from "../../shared/contributions/metadata";
import type { ResourceRef } from "../resources/resource-registry";
import { classicFrame } from "./classic-frame";
import type { Frame, FrameSlotSize, SlotsOf } from "./frame-types";

export const workbenchAreas = [
  "nav",
  "activity",
  "left-header",
  "left",
  "main-header",
  "main-left",
  "main",
  "main-right",
  "secondary-header",
  "secondary",
  "status",
  "overlay",
  "floating-header",
  "floating",
] as const;

export type WorkbenchArea = SlotsOf<typeof classicFrame>;

export type SlotId = string;

export type WorkbenchAreaSize = FrameSlotSize;

export type WidgetReusePolicy = "resource" | "none";

export type WidgetMountStrategy = "active" | "keep-mounted";

export interface WidgetContribution {
  id: string;
  title: string;
  area: SlotId;
  fallbackArea?: SlotId;
  singleton?: boolean;
  reuse?: WidgetReusePolicy;
  mountStrategy?: WidgetMountStrategy;
  closable?: boolean;
  // Non-closeable widgets opt into the tab visibility menu; closeable widgets
  // ignore this and use the X button for dismissal.
  hiddenByDefault?: boolean;
  areaSize?: WorkbenchAreaSize;
  areaCollapsible?: boolean;
  headerBorderBottom?: boolean;
  resourceKinds?: string[];
  priority?: number;
  rendererId: string;
  config?: unknown;
  canOpen?(resource: ResourceRef): boolean;
}

export type RegisteredWidgetContribution = Omit<WidgetContribution, "priority" | "singleton" | "reuse"> & {
  singleton: boolean;
  reuse: WidgetReusePolicy;
} & RegisteredContributionMetadata;

export interface PlaceholderContribution {
  id: string;
  title: string;
  area: SlotId;
  rendererId: string;
  areaSize?: WorkbenchAreaSize;
  areaCollapsible?: boolean;
  config?: unknown;
  priority?: number;
}

export type RegisteredPlaceholderContribution = Omit<PlaceholderContribution, "priority"> &
  RegisteredContributionMetadata;

export interface WorkbenchWidgetPlacement {
  widgetId: string;
  contributionId: string;
  ownerId?: string;
  source?: ContributionSource;
  resource?: ResourceRef;
  resourceUri?: string;
  title?: string;
  pinned?: boolean;
  closable?: boolean;
  mountStrategy?: WidgetMountStrategy;
  hiddenByDefault?: boolean;
}

export interface WorkbenchAreaState {
  id: SlotId;
  widgets: WorkbenchWidgetPlacement[];
  activeWidgetId?: string;
}

export interface WorkbenchLayoutNode {
  size?: number;
  collapsed?: boolean;
}

export interface WorkbenchLayout {
  areas: Record<SlotId, WorkbenchAreaState>;
  nodes: Record<SlotId, WorkbenchLayoutNode>;
  activeSlotId?: SlotId;
  activeResourceUri?: string;
  orphans?: Record<SlotId, WorkbenchAreaState>;
}

export interface WorkbenchLayoutStoreState {
  frame: Frame;
  layout: WorkbenchLayout;
  widgets: Record<string, RegisteredWidgetContribution>;
  placeholders: Record<SlotId, RegisteredPlaceholderContribution>;
}

export interface OpenWidgetInput {
  resource?: ResourceRef;
  title?: string;
  area?: SlotId;
  ownerId?: string;
  source?: ContributionSource;
  pinned?: boolean;
  closable?: boolean;
  mountStrategy?: WidgetMountStrategy;
  hiddenByDefault?: boolean;
  replaceActive?: boolean;
}

const createAreaState = (id: SlotId): WorkbenchAreaState => ({
  id,
  widgets: [],
});

export const createDefaultWorkbenchLayout = (frame: Frame = classicFrame): WorkbenchLayout => ({
  areas: Object.fromEntries(Object.keys(frame.slots).map((id) => [id, createAreaState(id)])),
  nodes: {},
});

const isNormalisedLayout = (layout: WorkbenchLayout) => {
  if (!layout || typeof layout !== "object" || !layout.areas || !layout.nodes) return false;
  return Object.entries(layout.areas).every(
    ([id, area]) => area && area.id === id && Array.isArray(area.widgets) && !("visible" in area) && !("size" in area),
  );
};

// Slots absent from the active frame are quarantined by key so their ordering and
// selection survive a frame round trip instead of being silently discarded.
export const mergeWithDefaultAreas = (persisted: WorkbenchLayout, frame: Frame = classicFrame): WorkbenchLayout => {
  const defaults = createDefaultWorkbenchLayout(frame);
  if (!isNormalisedLayout(persisted)) return defaults;

  const areas = { ...defaults.areas };
  const orphans: Record<SlotId, WorkbenchAreaState> = {};
  const candidates = { ...persisted.orphans, ...persisted.areas };

  for (const [id, area] of Object.entries(candidates)) {
    if (frame.slots[id]) areas[id] = area;
    else orphans[id] = area;
  }

  const activeSlotId = persisted.activeSlotId && areas[persisted.activeSlotId] ? persisted.activeSlotId : undefined;
  return {
    areas,
    nodes: persisted.nodes,
    activeSlotId,
    activeResourceUri: activeSlotId ? persisted.activeResourceUri : undefined,
    orphans: Object.keys(orphans).length > 0 ? orphans : undefined,
  };
};
