import type { ContributionSource, RegisteredContributionMetadata } from "../../shared/contributions/metadata";
import type { ResourceRef } from "../resources/resource-registry";
import { resolveUniqueWidgetId } from "./widget-id";

export const workbenchRegions = [
  "nav",
  "activity",
  "sidebar-header",
  "sidebar",
  "main-header",
  "main-left-menu",
  "main",
  "main-right-menu",
  "secondary-header",
  "secondary",
  "side-header",
  "side",
  "status",
  "overlay",
] as const;

export type WorkbenchRegion = (typeof workbenchRegions)[number];

export const workbenchPanelRegions = ["main", "secondary", "side"] as const satisfies readonly WorkbenchRegion[];

export type WorkbenchPanelRegion = (typeof workbenchPanelRegions)[number];

export interface WorkbenchRegionSize {
  defaultPx?: number;
  minPx?: number;
  maxPx?: number;
}

export type WidgetReusePolicy = "resource" | "none";

export type WidgetMountStrategy = "active" | "keep-mounted";

export interface WorkbenchWidgetTab {
  contentRendererId?: string;
  contextMenuRendererId?: string;
}

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
  regionSize?: WorkbenchRegionSize;
  regionCollapsible?: boolean;
  headerBorderBottom?: boolean;
  resourceKinds?: string[];
  priority?: number;
  rendererId: string;
  openCommandId?: string;
  // Only explicitly addable widgets appear in panel add menus and palette entries.
  panelAddable?: boolean;
  tab?: WorkbenchWidgetTab;
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
  title?: string;
  pinned?: boolean;
  closable?: boolean;
  mountStrategy?: WidgetMountStrategy;
  hiddenByDefault?: boolean;
  tab?: WorkbenchWidgetTab;
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
  activeWidgetId?: string;
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
  ownerId?: string;
  source?: ContributionSource;
  pinned?: boolean;
  closable?: boolean;
  mountStrategy?: WidgetMountStrategy;
  hiddenByDefault?: boolean;
  tab?: WorkbenchWidgetTab;
  replaceActive?: boolean;
}

const createRegionState = (id: WorkbenchRegion): WorkbenchRegionState => ({
  id,
  visible: true,
  widgets: [],
});

export const createDefaultWorkbenchLayout = (): WorkbenchLayout => ({
  regions: {
    nav: createRegionState("nav"),
    activity: createRegionState("activity"),
    "sidebar-header": createRegionState("sidebar-header"),
    sidebar: createRegionState("sidebar"),
    "main-header": createRegionState("main-header"),
    "main-left-menu": createRegionState("main-left-menu"),
    main: createRegionState("main"),
    "main-right-menu": createRegionState("main-right-menu"),
    "secondary-header": createRegionState("secondary-header"),
    secondary: createRegionState("secondary"),
    "side-header": createRegionState("side-header"),
    side: createRegionState("side"),
    status: createRegionState("status"),
    overlay: createRegionState("overlay"),
  },
});

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

export const mergeWithDefaultRegions = (persisted: WorkbenchLayout): WorkbenchLayout => {
  const defaults = createDefaultWorkbenchLayout();
  return normalizeWidgetIds({
    ...persisted,
    regions: { ...defaults.regions, ...persisted.regions },
  });
};
