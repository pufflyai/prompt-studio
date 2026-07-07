import type { ContributionSource, RegisteredContributionMetadata } from "../../shared/contributions/metadata";
import type { ResourceRef } from "../resources/resource-registry";

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

export type WorkbenchArea = (typeof workbenchAreas)[number];

export interface WorkbenchAreaSize {
  defaultPx?: number;
  minPx?: number;
  maxPx?: number;
}

export type WidgetReusePolicy = "resource" | "none";

export type WidgetMountStrategy = "active" | "keep-mounted";

export interface WidgetContribution {
  id: string;
  title: string;
  area: WorkbenchArea;
  fallbackArea?: WorkbenchArea;
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
  area: WorkbenchArea;
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
  id: WorkbenchArea;
  visible: boolean;
  size?: number;
  widgets: WorkbenchWidgetPlacement[];
  activeWidgetId?: string;
}

export interface WorkbenchLayout {
  areas: Record<WorkbenchArea, WorkbenchAreaState>;
  activeWidgetId?: string;
  activeResourceUri?: string;
}

export interface WorkbenchLayoutStoreState {
  layout: WorkbenchLayout;
  widgets: Record<string, RegisteredWidgetContribution>;
  placeholders: Partial<Record<WorkbenchArea, RegisteredPlaceholderContribution>>;
}

export interface OpenWidgetInput {
  resource?: ResourceRef;
  title?: string;
  area?: WorkbenchArea;
  ownerId?: string;
  source?: ContributionSource;
  pinned?: boolean;
  closable?: boolean;
  mountStrategy?: WidgetMountStrategy;
  hiddenByDefault?: boolean;
  replaceActive?: boolean;
}

const createAreaState = (id: WorkbenchArea): WorkbenchAreaState => ({
  id,
  visible: true,
  widgets: [],
});

export const createDefaultWorkbenchLayout = (): WorkbenchLayout => ({
  areas: {
    nav: createAreaState("nav"),
    activity: createAreaState("activity"),
    "left-header": createAreaState("left-header"),
    left: createAreaState("left"),
    "main-header": createAreaState("main-header"),
    "main-left": createAreaState("main-left"),
    main: createAreaState("main"),
    "main-right": createAreaState("main-right"),
    "secondary-header": createAreaState("secondary-header"),
    secondary: createAreaState("secondary"),
    status: createAreaState("status"),
    overlay: createAreaState("overlay"),
    "floating-header": createAreaState("floating-header"),
    floating: createAreaState("floating"),
  },
});

// Persisted layouts from before the area rename carry the old keys. Remap them (key and
// the area's own `id`) so a stored layout still merges into the current schema instead of
// silently orphaning those areas.
const RENAMED_AREA_IDS: Record<string, WorkbenchArea> = {
  top: "nav",
  activityBar: "activity",
  "main-bottom": "secondary",
  "main-bottom-header": "secondary-header",
};

// The side regions (main-left / main-right) are headerless, so these header areas no
// longer exist. They were always empty, so a stored layout loses nothing by dropping them.
const REMOVED_AREA_IDS = new Set(["main-left-header", "main-right-header"]);

const migrateAreaIds = (areas: WorkbenchLayout["areas"]): WorkbenchLayout["areas"] => {
  const migrated = {} as WorkbenchLayout["areas"];
  for (const [id, area] of Object.entries(areas) as [string, WorkbenchAreaState][]) {
    if (REMOVED_AREA_IDS.has(id)) continue;
    const nextId = RENAMED_AREA_IDS[id] ?? (id as WorkbenchArea);
    migrated[nextId] = area.id === nextId ? area : { ...area, id: nextId };
  }
  return migrated;
};

export const mergeWithDefaultAreas = (persisted: WorkbenchLayout): WorkbenchLayout => {
  const defaults = createDefaultWorkbenchLayout();
  return {
    ...persisted,
    areas: { ...defaults.areas, ...migrateAreaIds(persisted.areas) },
  };
};
