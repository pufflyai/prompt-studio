import type { ContributionSource, RegisteredContributionMetadata } from "../../shared/contributions/metadata";
import type { ResourceRef } from "../resources/resource-registry";
import { resolveUniqueWidgetId } from "./widget-id";

export const workbenchRegions = [
  "nav",
  "activity",
  "sidenav-header",
  "sidenav",
  "main-header",
  "main-left-menu",
  "main",
  "main-right-menu",
  "secondary-header",
  "secondary-left-menu",
  "secondary",
  "secondary-right-menu",
  "side-header",
  "side-left-menu",
  "side",
  "side-right-menu",
  "status",
  "overlay",
] as const;

export type WorkbenchRegion = (typeof workbenchRegions)[number];

export const workbenchPanelRegions = ["main", "secondary", "side"] as const satisfies readonly WorkbenchRegion[];

export type WorkbenchPanelRegion = (typeof workbenchPanelRegions)[number];

export type WorkbenchPanelMenuSide = "left" | "right";

export const workbenchPanelMenuRegions = {
  main: { left: "main-left-menu", right: "main-right-menu" },
  secondary: { left: "secondary-left-menu", right: "secondary-right-menu" },
  side: { left: "side-left-menu", right: "side-right-menu" },
} as const satisfies Record<WorkbenchPanelRegion, Record<WorkbenchPanelMenuSide, WorkbenchRegion>>;

export type WorkbenchPanelMenuRegion = (typeof workbenchPanelMenuRegions)[WorkbenchPanelRegion][WorkbenchPanelMenuSide];

const workbenchPanelByMenuRegion = {
  "main-left-menu": "main",
  "main-right-menu": "main",
  "secondary-left-menu": "secondary",
  "secondary-right-menu": "secondary",
  "side-left-menu": "side",
  "side-right-menu": "side",
} as const satisfies Record<WorkbenchPanelMenuRegion, WorkbenchPanelRegion>;

export const getWorkbenchPanelForMenuRegion = (region: WorkbenchPanelMenuRegion) => workbenchPanelByMenuRegion[region];

export interface WorkbenchRegionSize {
  defaultPx?: number;
  minPx?: number;
  maxPx?: number;
}

export type WidgetReusePolicy = "resource" | "none";

export type WidgetMountStrategy = "active" | "keep-mounted";

export type WorkbenchPanelReusePolicy = WidgetReusePolicy;

export type WorkbenchPanelMountStrategy = WidgetMountStrategy;

export type WorkbenchFloatingPanelVisibility = "visible" | "hidden";

export type WorkbenchWidgetRole = "content" | "location" | "sub-panel" | "panel-menu";

export type WorkbenchTabRetention = "preview" | "persistent";

export type WorkbenchTabPosition = "start" | "end" | { beforeWidgetId: string } | { afterWidgetId: string };

export interface WorkbenchLocationEligibility {
  modeIds?: string[];
  resourceKinds?: string[];
  resourceIds?: string[];
  canOpen?(resource: ResourceRef): boolean;
}

export type WorkbenchPanelMenuOwner =
  | { level: "panel"; contributionId?: string }
  | { level: "sub-panel"; contributionId: string };

export interface WorkbenchWidgetTab {
  contentRendererId?: string;
  /** Custom actions shown when the user activates an already-active tab. */
  customMenuRendererId?: string;
}

export type WorkbenchPanelTab = WorkbenchWidgetTab;

export interface WidgetContribution {
  id: string;
  title: string;
  icon?: string;
  region: WorkbenchRegion;
  fallbackRegion?: WorkbenchRegion;
  singleton?: boolean;
  reuse?: WidgetReusePolicy;
  mountStrategy?: WidgetMountStrategy;
  closable?: boolean;
  // Non-closeable widgets opt into the tab visibility menu; closeable widgets
  // ignore this and use the X button for dismissal.
  hiddenByDefault?: boolean;
  // A Location that presents only its Sub Panels: it renders no tab and no
  // content of its own — establishing it activates its first Sub Panel.
  subPanelsOnly?: boolean;
  regionSize?: WorkbenchRegionSize;
  regionCollapsible?: boolean;
  headerBorderBottom?: boolean;
  floatingPanels?: WorkbenchFloatingPanelVisibility;
  resourceKinds?: string[];
  priority?: number;
  rendererId: string;
  openCommandId?: string;
  role?: WorkbenchWidgetRole;
  eligibleLocations?: WorkbenchLocationEligibility;
  panelMenuOwner?: WorkbenchPanelMenuOwner;
  tab?: WorkbenchWidgetTab;
  config?: unknown;
  canOpen?(resource: ResourceRef): boolean;
}

export interface WorkbenchPanelMenuDefinition {
  id: string;
  title: string;
  icon?: string;
  side: WorkbenchPanelMenuSide;
  singleton?: boolean;
  reuse?: WorkbenchPanelReusePolicy;
  mountStrategy?: WorkbenchPanelMountStrategy;
  hiddenByDefault?: boolean;
  regionSize?: WorkbenchRegionSize;
  regionCollapsible?: boolean;
  headerBorderBottom?: boolean;
  rendererId: string;
  priority?: number;
  config?: unknown;
}

interface WorkbenchPanelMenusContribution {
  panelMenus?: readonly WorkbenchPanelMenuDefinition[];
}

export interface WorkbenchPanelContribution {
  id: string;
  title: string;
  icon?: string;
  region: WorkbenchRegion;
  fallbackRegion?: WorkbenchRegion;
  rendererId: string;
  closable: boolean;
  singleton?: boolean;
  reuse?: WorkbenchPanelReusePolicy;
  mountStrategy?: WorkbenchPanelMountStrategy;
  hiddenByDefault?: boolean;
  subPanelsOnly?: boolean;
  regionSize?: WorkbenchRegionSize;
  regionCollapsible?: boolean;
  headerBorderBottom?: boolean;
  floatingPanels?: WorkbenchFloatingPanelVisibility;
  resourceKinds?: string[];
  eligibleLocations?: WorkbenchLocationEligibility;
  priority?: number;
  openCommandId?: string;
  tab?: WorkbenchPanelTab;
  config?: unknown;
  canOpen?(resource: ResourceRef): boolean;
  ownerId?: string;
  source?: ContributionSource;
  panelMenus?: readonly WorkbenchPanelMenuDefinition[];
}

export type WorkbenchLocationContribution = Omit<WidgetContribution, "role"> & WorkbenchPanelMenusContribution;

export type WorkbenchSubPanelContribution = Omit<WidgetContribution, "region" | "fallbackRegion" | "role"> & {
  region: WorkbenchPanelRegion;
  fallbackRegion?: WorkbenchPanelRegion;
} & WorkbenchPanelMenusContribution;

export type WorkbenchPanelMenuContribution = Omit<WidgetContribution, "region" | "fallbackRegion" | "role"> & {
  region: WorkbenchPanelMenuRegion;
  fallbackRegion?: WorkbenchPanelMenuRegion;
};

export type RegisteredWidgetContribution = Omit<WidgetContribution, "priority" | "singleton" | "reuse"> & {
  ownedPanelMenuIds?: readonly string[];
  singleton: boolean;
  reuse: WidgetReusePolicy;
  role: WorkbenchWidgetRole;
} & RegisteredContributionMetadata;

export interface PlaceholderContribution {
  id: string;
  title: string;
  region: WorkbenchRegion;
  rendererId: string;
  regionSize?: WorkbenchRegionSize;
  regionCollapsible?: boolean;
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
  ownerResourceUri?: string;
  title?: string;
  pinned?: boolean;
  closable?: boolean;
  mountStrategy?: WidgetMountStrategy;
  hiddenByDefault?: boolean;
  tabRetention?: WorkbenchTabRetention;
  tab?: WorkbenchWidgetTab;
  role?: WorkbenchWidgetRole;
}

export interface WorkbenchPanelInstance {
  instanceId: string;
  panelId: string;
  ownerId?: string;
  source?: ContributionSource;
  resource?: ResourceRef;
  resourceUri?: string;
  ownerResourceUri?: string;
  title?: string;
  pinned?: boolean;
  closable: boolean;
  mountStrategy?: WorkbenchPanelMountStrategy;
  hiddenByDefault?: boolean;
  tabRetention?: WorkbenchTabRetention;
  tab?: WorkbenchPanelTab;
}

export interface WorkbenchRegionState {
  id: WorkbenchRegion;
  visible: boolean;
  size?: number;
  widgets: WorkbenchWidgetPlacement[];
  activeWidgetId?: string;
}

export interface WorkbenchLayout {
  regions: Record<WorkbenchRegion, WorkbenchRegionState>;
  locationSubPanelSelections?: Record<string, Partial<Record<WorkbenchPanelRegion, string>>>;
  activeWidgetId?: string;
  activeLocationWidgetId?: string;
  activeResourceUri?: string;
}

export interface WorkbenchLayoutStoreState {
  layout: WorkbenchLayout;
  widgets: Record<string, RegisteredWidgetContribution>;
  placeholders: Partial<Record<WorkbenchRegion, RegisteredPlaceholderContribution>>;
}

export interface OpenWidgetInput {
  resource?: ResourceRef;
  title?: string;
  region?: WorkbenchRegion;
  // The role this placement takes, when the caller knows it better than the widget
  // does. A panel is a Location in main and a Sub Panel elsewhere, so a placement made
  // by the composition resolver carries the role its region implies.
  role?: WorkbenchWidgetRole;
  ownerId?: string;
  source?: ContributionSource;
  pinned?: boolean;
  closable?: boolean;
  mountStrategy?: WidgetMountStrategy;
  hiddenByDefault?: boolean;
  tabRetention?: WorkbenchTabRetention;
  tabPosition?: WorkbenchTabPosition;
  tab?: WorkbenchWidgetTab;
  replaceActive?: boolean;
  replaceWidgetId?: string;
}

export type WorkbenchPanelOpenStrategy =
  | { kind: "persistent"; position?: WorkbenchTabPosition }
  | { kind: "replace-active" }
  | { kind: "replace-panel"; instanceId: string; retention?: WorkbenchTabRetention }
  | { kind: "preview"; position?: WorkbenchTabPosition };

export interface OpenWorkbenchPanelInput {
  resource?: ResourceRef;
  title?: string;
  region?: WorkbenchRegion;
  pinned?: boolean;
  mountStrategy?: WorkbenchPanelMountStrategy;
  hiddenByDefault?: boolean;
  tab?: WorkbenchPanelTab;
  strategy?: WorkbenchPanelOpenStrategy;
}

const createRegionState = (id: WorkbenchRegion, visible: boolean): WorkbenchRegionState => ({
  id,
  visible,
  widgets: [],
});

export const createDefaultWorkbenchLayout = (
  regionVisibility: Partial<Record<WorkbenchRegion, boolean>> = {},
): WorkbenchLayout => {
  const createRegion = (id: WorkbenchRegion) => createRegionState(id, regionVisibility[id] ?? true);

  return {
    regions: {
      nav: createRegion("nav"),
      activity: createRegion("activity"),
      "sidenav-header": createRegion("sidenav-header"),
      sidenav: createRegion("sidenav"),
      "main-header": createRegion("main-header"),
      "main-left-menu": createRegion("main-left-menu"),
      main: createRegion("main"),
      "main-right-menu": createRegion("main-right-menu"),
      "secondary-header": createRegion("secondary-header"),
      "secondary-left-menu": createRegion("secondary-left-menu"),
      secondary: createRegion("secondary"),
      "secondary-right-menu": createRegion("secondary-right-menu"),
      "side-header": createRegion("side-header"),
      "side-left-menu": createRegion("side-left-menu"),
      side: createRegion("side"),
      "side-right-menu": createRegion("side-right-menu"),
      status: createRegion("status"),
      overlay: createRegion("overlay"),
    },
  };
};

const findLastWidgetIndex = (widgets: WorkbenchWidgetPlacement[], widgetId: string) => {
  for (let index = widgets.length - 1; index >= 0; index -= 1) {
    if (widgets[index]?.widgetId === widgetId) return index;
  }
  return -1;
};

const normalizeWidgetIds = (layout: WorkbenchLayout) => {
  const widgetIds = new Set<string>();
  const regions = {} as WorkbenchLayout["regions"];
  let activeWidgetId = layout.activeWidgetId;
  let activeResourceUri = layout.activeResourceUri;

  for (const [id, region] of Object.entries(layout.regions) as [WorkbenchRegion, WorkbenchRegionState][]) {
    const originalActiveWidgetId = region.activeWidgetId;
    const activeIndex = originalActiveWidgetId ? findLastWidgetIndex(region.widgets, originalActiveWidgetId) : -1;
    const widgets = region.widgets.map((placement) => {
      const widgetId = resolveUniqueWidgetId(widgetIds, placement.contributionId, placement.widgetId);
      widgetIds.add(widgetId);
      return widgetId === placement.widgetId ? placement : { ...placement, widgetId };
    });
    const normalizedActiveWidgetId = activeIndex >= 0 ? widgets[activeIndex]?.widgetId : originalActiveWidgetId;
    regions[id] = { ...region, widgets, activeWidgetId: normalizedActiveWidgetId };

    if (originalActiveWidgetId && layout.activeWidgetId === originalActiveWidgetId && activeIndex >= 0) {
      activeWidgetId = normalizedActiveWidgetId;
      activeResourceUri = widgets[activeIndex]?.resourceUri;
    }
  }

  return { ...layout, regions, activeWidgetId, activeResourceUri };
};

export const mergeWithDefaultRegions = (
  persisted: WorkbenchLayout,
  regionVisibility: Partial<Record<WorkbenchRegion, boolean>> = {},
): WorkbenchLayout => {
  const defaults = createDefaultWorkbenchLayout(regionVisibility);
  return normalizeWidgetIds({
    ...persisted,
    regions: { ...defaults.regions, ...persisted.regions },
  });
};
