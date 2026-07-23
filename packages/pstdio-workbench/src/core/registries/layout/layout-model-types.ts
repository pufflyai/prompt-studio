import type { ContributionMetadata } from "../../shared/contributions/metadata";
import type { WorkbenchStore } from "../../shared/store/workbench-store";
import type {
  OpenWidgetInput,
  PlaceholderContribution,
  RegisteredPlaceholderContribution,
  RegisteredWidgetContribution,
  WidgetContribution,
  WorkbenchLayout,
  WorkbenchLayoutStoreState,
  WorkbenchLocationContribution,
  WorkbenchPanelMenuContribution,
  WorkbenchRegion,
  WorkbenchRegionSize,
  WorkbenchSubPanelContribution,
  WorkbenchTabPosition,
  WorkbenchWidgetPlacement,
} from "./layout-types";

export type LayoutScope = string;

export interface LayoutPersistenceAdapter {
  getLayout(scope?: LayoutScope): WorkbenchLayout | undefined;
  setLayout(layout: WorkbenchLayout, scope?: LayoutScope): void;
  flush?(): void;
  dispose?(): void;
}

export interface CreateLayoutModelInput {
  defaultRegionVisibility?: Partial<Record<WorkbenchRegion, boolean>>;
  persistence?: LayoutPersistenceAdapter;
}

export interface LayoutModel {
  store: WorkbenchStore<WorkbenchLayoutStoreState>;
  registerPlaceholder(placeholder: PlaceholderContribution, metadata?: ContributionMetadata): { dispose(): void };
  registerWidget(widget: WidgetContribution, metadata?: ContributionMetadata): { dispose(): void };
  registerLocation(location: WorkbenchLocationContribution, metadata?: ContributionMetadata): { dispose(): void };
  registerSubPanel(subPanel: WorkbenchSubPanelContribution, metadata?: ContributionMetadata): { dispose(): void };
  registerPanelMenu(panelMenu: WorkbenchPanelMenuContribution, metadata?: ContributionMetadata): { dispose(): void };
  unregisterWidget(id: string, options?: { removePlacements?: boolean; persist?: boolean }): void;
  getPlaceholder(regionId: WorkbenchRegion): RegisteredPlaceholderContribution | undefined;
  getWidget(id: string): RegisteredWidgetContribution | undefined;
  getRegionSize(regionId: WorkbenchRegion): WorkbenchRegionSize | undefined;
  getRegionCollapsible(regionId: WorkbenchRegion): boolean;
  getRegionHeaderBorderBottom(regionId: WorkbenchRegion): boolean;
  setRegionVisible(regionId: WorkbenchRegion, visible: boolean): void;
  setRegionSize(regionId: WorkbenchRegion, size: number): void;
  listPlaceholders(): RegisteredPlaceholderContribution[];
  listWidgets(): RegisteredWidgetContribution[];
  openWidget(id: string, input?: OpenWidgetInput): WorkbenchWidgetPlacement;
  updateWidgetPlacement(widgetId: string, input: OpenWidgetInput): WorkbenchWidgetPlacement;
  reorderWidget(widgetId: string, position: WorkbenchTabPosition): void;
  expirePreviewTabs(ownerResourceUri?: string): void;
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
  onWillChangePersistenceScope(listener: (scope: LayoutScope | undefined) => void): { dispose(): void };
  onDidChangePersistenceScope(listener: (scope: LayoutScope | undefined) => void): { dispose(): void };
}
