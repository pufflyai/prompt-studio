import type { WorkbenchPanelMenuRegion, WorkbenchPanelRegion } from "../../registries/layout/layout-types";
import type { ResourceRef } from "../../registries/resources/resource-registry";

export interface WorkbenchSubPanelRef {
  contributionId: string;
  resourceUri?: string;
  instanceKey?: string;
}

export interface WorkbenchLocationRef {
  key: string;
  modeId?: string;
  resource?: ResourceRef;
  contributionId?: string;
  instanceKey?: string;
  title?: string;
}

export interface WorkbenchLocation extends WorkbenchLocationRef {
  breadcrumbs?: readonly ResourceRef[];
}

export interface WorkbenchPanelMenuRef {
  contributionId: string;
  resourceUri?: string;
  instanceKey?: string;
}

export interface WorkbenchPanelWorkspaceState {
  visible: boolean;
  size?: number;
}

export interface WorkbenchPanelMenuWorkspaceState extends WorkbenchPanelWorkspaceState {
  attached: boolean;
  collapsed: boolean;
  openMenus: readonly WorkbenchPanelMenuRef[];
}

export interface WorkbenchLocationWorkspaceState {
  openSubPanels: Partial<Record<WorkbenchPanelRegion, readonly WorkbenchSubPanelRef[]>>;
  selectedSubPanels: Partial<Record<WorkbenchPanelRegion, WorkbenchSubPanelRef>>;
  panels: Partial<Record<WorkbenchPanelRegion, WorkbenchPanelWorkspaceState>>;
  panelMenus: Partial<Record<WorkbenchPanelMenuRegion, WorkbenchPanelMenuWorkspaceState>>;
}

export interface WorkbenchClosedSubPanel {
  region: WorkbenchPanelRegion;
  reference: WorkbenchSubPanelRef;
  resource?: ResourceRef;
  title?: string;
}

export interface WorkbenchNavigationEntry {
  entryId: string;
  recordedAt: number;
  location: WorkbenchLocationRef;
  selectedSubPanels: Partial<Record<WorkbenchPanelRegion, WorkbenchSubPanelRef>>;
  kind: "resource" | "widget" | "mode";
  modeId?: string;
  resource?: ResourceRef;
  widgetId?: string;
  contributionId?: string;
  title?: string;
  closedSubPanel?: WorkbenchClosedSubPanel;
}

export type HistoryEntry = WorkbenchNavigationEntry;

export interface HistoryStoreState {
  entries: readonly WorkbenchNavigationEntry[];
  cursor: number;
  recentlyClosed: readonly WorkbenchNavigationEntry[];
  hydrating: boolean;
}

export interface PersistedWorkbenchHistory extends Omit<HistoryStoreState, "hydrating"> {
  version: 1;
}

export interface WorkbenchHistoryPersistence {
  getHistory(scope?: string): PersistedWorkbenchHistory | undefined;
  setHistory(state: PersistedWorkbenchHistory, scope?: string): void;
}
