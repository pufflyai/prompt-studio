import type { ContributionMetadata } from "../../shared/contributions/metadata";
import type { WorkbenchStore } from "../../shared/store/workbench-store";
import type {
  OpenWidgetInput,
  OpenWorkbenchPanelInput,
  PlaceholderContribution,
  RegisteredPlaceholderContribution,
  RegisteredWidgetContribution,
  WidgetContribution,
  WorkbenchLayout,
  WorkbenchLayoutStoreState,
  WorkbenchPanelContribution,
  WorkbenchPanelInstance,
  WorkbenchPanelMenuContribution,
  WorkbenchRegion,
  WorkbenchRegionSettings,
  WorkbenchRegionSize,
  WorkbenchSidePanelMode,
  WorkbenchTabPosition,
  WorkbenchWidgetPlacement,
} from "./layout-types";

export type LayoutScope = string;

export interface LayoutPersistenceAdapter {
  getLayout(scope?: LayoutScope): WorkbenchLayout | undefined;
  setLayout(layout: WorkbenchLayout, scope?: LayoutScope): void;
  /** Remove a saved scope and cancel its pending writes. */
  removeLayout?(scope?: LayoutScope): void;
  /** All saved layouts, including pending writes and inactive scopes. */
  listLayouts?(): { scope?: string; layout: WorkbenchLayout }[];
  /** Changes made by this adapter, including transforms and evictions. */
  onDidChangeLayout?(listener: (scope: string | undefined, layout: WorkbenchLayout | undefined) => void): () => void;
  listScopes?(projectId: string): LayoutScope[];
  transformLayouts?(
    projectId: string,
    transform: (layout: WorkbenchLayout, scope: LayoutScope) => WorkbenchLayout | undefined,
  ): void;
  getCompatibilityMarker?(key: string): string | undefined;
  setCompatibilityMarker?(key: string, value: string): void;
  advanceWriteGeneration?(): number;
  flush?(): void;
  dispose?(): void;
}

export interface CreateLayoutModelInput {
  defaultRegionVisibility?: Partial<Record<WorkbenchRegion, boolean>>;
  persistence?: LayoutPersistenceAdapter;
  normalizeLayout?(layout: WorkbenchLayout): WorkbenchLayout;
  validateRegionChange?(region: WorkbenchRegion, action: "open" | "close" | "resize"): void;
  validateWidgetOpen?(
    region: WorkbenchRegion,
    existing: WorkbenchWidgetPlacement | undefined,
    target: OpenWidgetInput,
  ): void;
  /** Region policy for the active context; the layout asks on every query. */
  getRegionSettings?(regionId: WorkbenchRegion, modeId?: string): WorkbenchRegionSettings | undefined;
  /** Main owners rendered outside the tab layout, such as tabless page content. Their menus are not orphans. */
  getDetachedOwners?(): readonly WorkbenchWidgetPlacement[];
}

export interface LayoutModel {
  store: WorkbenchStore<WorkbenchLayoutStoreState>;
  registerPlaceholder(placeholder: PlaceholderContribution, metadata?: ContributionMetadata): { dispose(): void };
  registerPanel(panel: WorkbenchPanelContribution, metadata?: ContributionMetadata): { dispose(): void };
  registerWidget(widget: WidgetContribution, metadata?: ContributionMetadata): { dispose(): void };
  registerPanelMenu(panelMenu: WorkbenchPanelMenuContribution, metadata?: ContributionMetadata): { dispose(): void };
  unregisterWidget(id: string, options?: { removePlacements?: boolean; persist?: boolean }): void;
  getPlaceholder(regionId: WorkbenchRegion): RegisteredPlaceholderContribution | undefined;
  getWidget(id: string): RegisteredWidgetContribution | undefined;
  getPanel(id: string): WorkbenchPanelContribution | undefined;
  getRegionSize(regionId: WorkbenchRegion): WorkbenchRegionSize | undefined;
  getRegionSettings(regionId: WorkbenchRegion, modeId?: string): WorkbenchRegionSettings | undefined;
  getRegionCollapsible(regionId: WorkbenchRegion): boolean;
  getRegionHeaderBorderBottom(regionId: WorkbenchRegion): boolean;
  setRegionVisible(regionId: WorkbenchRegion, visible: boolean): void;
  setRegionSize(regionId: WorkbenchRegion, size: number): void;
  setSidePanelMode(mode: WorkbenchSidePanelMode): void;
  listPlaceholders(): RegisteredPlaceholderContribution[];
  listWidgets(): RegisteredWidgetContribution[];
  listPanels(): WorkbenchPanelContribution[];
  listPanelInstances(region?: WorkbenchRegion): WorkbenchPanelInstance[];
  getActivePanel(region?: WorkbenchRegion): WorkbenchPanelInstance | undefined;
  openWidget(id: string, input?: OpenWidgetInput): WorkbenchWidgetPlacement;
  openPanel(id: string, input?: OpenWorkbenchPanelInput): WorkbenchPanelInstance;
  updatePanel(instanceId: string, input: OpenWorkbenchPanelInput): WorkbenchPanelInstance;
  reorderPanel(instanceId: string, position: WorkbenchTabPosition): void;
  /** Explicit panel selection, excluding automatic focus after closing or restoring. */
  onDidActivatePanel(listener: (panel: WorkbenchPanelInstance) => void): { dispose(): void };
  onWillRestoreLayout(listener: () => void): { dispose(): void };
  activatePanel(instanceId: string): WorkbenchPanelInstance;
  closePanel(instanceId: string): WorkbenchPanelInstance | undefined;
  updateWidgetPlacement(widgetId: string, input: OpenWidgetInput): WorkbenchWidgetPlacement;
  reorderWidget(widgetId: string, position: WorkbenchTabPosition): void;
  expirePreviewTabs(ownerResourceKey?: string): void;
  activateWidget(widgetId: string): WorkbenchWidgetPlacement;
  setRegionActiveWidget(regionId: WorkbenchRegion, widgetId: string | undefined): void;
  closeWidget(widgetId: string): WorkbenchWidgetPlacement | undefined;
  removeWidgetPlacement(widgetId: string): WorkbenchWidgetPlacement | undefined;
  clearRegion(regionId: WorkbenchRegion): void;
  resetRegions(): void;
  getLayout(): WorkbenchLayout;
  restoreLayout(layout: WorkbenchLayout): void;
  setPersistenceScope(scope: LayoutScope | undefined, input?: { carryRegionState?: readonly WorkbenchRegion[] }): void;
  getPersistenceScope(): LayoutScope | undefined;
  /** True when the current persistence scope already stores a layout. A new scope returns false. */
  /** Whether anything is stored for the active scope right now. */
  hasPersistedLayout(): boolean;
  /**
   * Whether the active scope was entered with a layout the user already had. Unlike
   * `hasPersistedLayout`, writes made while entering a mode do not change the answer.
   */
  enteredWithPersistedLayout(): boolean;
  /** Moves owned panel menus beside their owner's current region and removes orphan menus. */
  reconcilePanelMenus(): void;
  onWillChangePersistenceScope(listener: (scope: LayoutScope | undefined) => void): { dispose(): void };
  onDidChangePersistenceScope(listener: (scope: LayoutScope | undefined) => void): { dispose(): void };
}
