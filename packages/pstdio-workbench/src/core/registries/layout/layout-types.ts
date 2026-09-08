import type { FileRendererSectionTarget, ModeRegionSettings, PlacementIdentity } from "@pstdio/sdk/extensions";
import type { ContributionSource, RegisteredContributionMetadata } from "../../shared/contributions/metadata";
import type { NavigationTarget } from "../navigation/navigation-registry";
import type { ResourceRef } from "../resources/resource-registry";

import type {
  WorkbenchPanelMenuRegion,
  WorkbenchPanelMenuSide,
  WorkbenchPanelRegion,
  WorkbenchRegion,
} from "./layout-regions";

export { createDefaultWorkbenchLayout, mergeWithDefaultRegions } from "./layout-defaults";
export * from "./layout-regions";

export interface WorkbenchRegionSize {
  defaultPx?: number;
  minPx?: number;
  maxPx?: number;
}

/** Region-level layout policy owned by the active mode or the host, never by a placement. */
export type WorkbenchRegionSettings = ModeRegionSettings;

export type WidgetReusePolicy = "resource" | "none";

export type WidgetMountStrategy = "active" | "keep-mounted";

export type WorkbenchPanelReusePolicy = WidgetReusePolicy;

export type WorkbenchPanelMountStrategy = WidgetMountStrategy;

export type WorkbenchWidgetRole = "content" | "location" | "sub-panel" | "panel-menu";

export type WorkbenchTabRetention = "preview" | "persistent";

export type WorkbenchTabPosition = "start" | "end" | { beforeWidgetId: string } | { afterWidgetId: string };

export interface WorkbenchLocationEligibility {
  modeIds?: string[];
  resourceKinds?: string[];
  resourceIds?: string[];
  canOpen?(resource: ResourceRef): boolean;
  canOpenLocation?(location: { resource?: ResourceRef; viewId?: string }): boolean;
}

export type WorkbenchPanelMenuOwner =
  | { level: "panel"; contributionId?: string }
  | { level: "sub-panel"; contributionId: string };

export interface WorkbenchCommandTarget {
  commandId: string;
  args?: unknown;
}

export type WorkbenchTabAction =
  | ({ kind: "command" } & WorkbenchCommandTarget)
  | { kind: "navigation"; target: NavigationTarget };

export interface WorkbenchTabMenuRow {
  id: string;
  label: string;
  icon?: string;
  iconColor?: string;
  selected?: boolean;
  disabled?: boolean;
  action?: WorkbenchTabAction;
}

export interface WorkbenchTabMenuGroup {
  id: string;
  rows: readonly WorkbenchTabMenuRow[];
}

export interface WorkbenchTabSnapshot {
  label?: string;
  icon?: string;
  indicator?: { icon: string; color?: string; label?: string };
  menu?: readonly WorkbenchTabMenuGroup[];
}

export interface WorkbenchWidgetTab {
  getSnapshot(instance: WorkbenchPanelInstance): WorkbenchTabSnapshot;
  subscribe?(listener: () => void): { dispose(): void } | (() => void);
  refreshEvents?: readonly string[];
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
  regionSize?: WorkbenchRegionSize;
  regionCollapsible?: boolean;
  headerBorderBottom?: boolean;
  resourceKinds?: string[];
  priority?: number;
  rendererId: string;
  openCommand?: WorkbenchCommandTarget;
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

export interface WorkbenchPanelContribution {
  id: string;
  title: string;
  icon?: string;
  region: WorkbenchRegion;
  fallbackRegion?: WorkbenchRegion;
  rendererId: string;
  singleton?: boolean;
  reuse?: WorkbenchPanelReusePolicy;
  mountStrategy?: WorkbenchPanelMountStrategy;
  closable?: boolean;
  hiddenByDefault?: boolean;
  regionSize?: WorkbenchRegionSize;
  regionCollapsible?: boolean;
  headerBorderBottom?: boolean;
  resourceKinds?: string[];
  eligibleLocations?: WorkbenchLocationEligibility;
  priority?: number;
  openCommand?: WorkbenchCommandTarget;
  tab?: WorkbenchPanelTab;
  config?: unknown;
  canOpen?(resource: ResourceRef): boolean;
  ownerId?: string;
  source?: ContributionSource;
  panelMenus?: readonly WorkbenchPanelMenuDefinition[];
}

export type WorkbenchPanelMenuContribution = Omit<WidgetContribution, "region" | "fallbackRegion"> & {
  region: WorkbenchPanelMenuRegion;
  fallbackRegion?: WorkbenchPanelMenuRegion;
};

export type RegisteredWidgetContribution = Omit<WidgetContribution, "priority" | "singleton" | "reuse"> & {
  ownedPanelMenuIds?: readonly string[];
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
  // Owner-scoped composition uses this canonical identity. Widget IDs remain renderer keys
  // and must never be parsed to recover placement ownership.
  placementIdentity?: PlacementIdentity;
  viewId?: string;
  ownerId?: string;
  source?: ContributionSource;
  resource?: ResourceRef;
  section?: FileRendererSectionTarget;
  resourceKey?: string;
  ownerResourceKey?: string;
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
  placementIdentity?: PlacementIdentity;
  viewId?: string;
  ownerId?: string;
  source?: ContributionSource;
  resource?: ResourceRef;
  section?: FileRendererSectionTarget;
  resourceKey?: string;
  ownerResourceKey?: string;
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
  activeResourceKey?: string;
}

export interface WorkbenchLayoutStoreState {
  layout: WorkbenchLayout;
  widgets: Record<string, RegisteredWidgetContribution>;
  placeholders: Partial<Record<WorkbenchRegion, RegisteredPlaceholderContribution>>;
}

export interface OpenWidgetInput {
  viewId?: string | null;
  resource?: ResourceRef | null;
  title?: string;
  region?: WorkbenchRegion;
  // The role this placement takes when the caller knows it better than the widget.
  // A panel is a Location in main and a Sub Panel elsewhere.
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
  /** Set by the view registry. Low-level layout callers should leave this undefined. */
  viewId?: string | null;
  /** `null` explicitly clears an existing singleton placement's resource binding. */
  resource?: ResourceRef | null;
  title?: string;
  region?: WorkbenchRegion;
  role?: WorkbenchWidgetRole;
  pinned?: boolean;
  closable?: boolean;
  mountStrategy?: WorkbenchPanelMountStrategy;
  hiddenByDefault?: boolean;
  tab?: WorkbenchPanelTab;
  strategy?: WorkbenchPanelOpenStrategy;
}
