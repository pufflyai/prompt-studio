import type { ContributionMetadata } from "../../shared/contributions/metadata";
import { createDisposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import { classicFrame } from "./classic-frame";
import type { Frame } from "./frame-types";
import { createContributionLists, createContributionRegistrations } from "./layout-model-contributions";
import { createWidgetOpeners } from "./layout-model-openers";
import { createAreaQueries } from "./layout-model-queries";
import {
  activateInLayout,
  buildUpdatedPlacement,
  closeWidgetInLayout,
  removePlacementsForContribution,
  replaceAreaWidgets,
} from "./layout-operations";
import {
  createDefaultWorkbenchLayout,
  mergeWithDefaultAreas,
  type OpenWidgetInput,
  type PlaceholderContribution,
  type RegisteredPlaceholderContribution,
  type RegisteredWidgetContribution,
  type SlotId,
  type WidgetContribution,
  type WorkbenchArea,
  type WorkbenchAreaSize,
  type WorkbenchLayout,
  type WorkbenchLayoutNode,
  type WorkbenchLayoutStoreState,
  type WorkbenchWidgetPlacement,
} from "./layout-types";

export type {
  OpenWidgetInput,
  PlaceholderContribution,
  RegisteredPlaceholderContribution,
  RegisteredWidgetContribution,
  SlotId,
  WidgetContribution,
  WidgetMountStrategy,
  WidgetReusePolicy,
  WorkbenchArea,
  WorkbenchAreaSize,
  WorkbenchAreaState,
  WorkbenchLayout,
  WorkbenchLayoutNode,
  WorkbenchLayoutStoreState,
  WorkbenchWidgetPlacement,
} from "./layout-types";
export { createDefaultWorkbenchLayout, workbenchAreas } from "./layout-types";

export type LayoutScope = string;

export interface LayoutPersistenceAdapter {
  // `scope` undefined → global slot (current behavior).
  getLayout(scope?: LayoutScope): WorkbenchLayout | undefined;
  setLayout(layout: WorkbenchLayout, scope?: LayoutScope): void;
}

export interface CreateLayoutModelInput {
  frame?: Frame;
  persistence?: LayoutPersistenceAdapter;
}

export interface LayoutModel {
  store: WorkbenchStore<WorkbenchLayoutStoreState>;
  getFrame(): Frame;
  registerPlaceholder(placeholder: PlaceholderContribution, metadata?: ContributionMetadata): { dispose(): void };
  registerWidget(widget: WidgetContribution, metadata?: ContributionMetadata): { dispose(): void };
  unregisterWidget(id: string, options?: { removePlacements?: boolean; persist?: boolean }): void;
  getPlaceholder(areaId: SlotId): RegisteredPlaceholderContribution | undefined;
  getWidget(id: string): RegisteredWidgetContribution | undefined;
  getAreaSize(areaId: SlotId): WorkbenchAreaSize | undefined;
  getAreaCollapsible(areaId: SlotId): boolean;
  getAreaHeaderBorderBottom(areaId: SlotId): boolean;
  setAreaVisible(areaId: SlotId, visible: boolean): void;
  setAreaSize(areaId: SlotId, size: number): void;
  listPlaceholders(): RegisteredPlaceholderContribution[];
  listWidgets(): RegisteredWidgetContribution[];
  openWidget(id: string, input?: OpenWidgetInput): WorkbenchWidgetPlacement;
  updateWidgetPlacement(widgetId: string, input: OpenWidgetInput): WorkbenchWidgetPlacement;
  activateWidget(widgetId: string): WorkbenchWidgetPlacement;
  closeWidget(widgetId: string): WorkbenchWidgetPlacement | undefined;
  removeWidgetPlacement(widgetId: string): WorkbenchWidgetPlacement | undefined;
  clearArea(areaId: SlotId): void;
  resetAreas(): void;
  getLayout(): WorkbenchLayout;
  restoreLayout(layout: WorkbenchLayout): void;
  setPersistenceScope(scope: LayoutScope | undefined): void;
  getPersistenceScope(): LayoutScope | undefined;
  onDidChangePersistenceScope(listener: (scope: LayoutScope | undefined) => void): { dispose(): void };
}

export const createLayoutModel = (input: CreateLayoutModelInput = {}): LayoutModel => {
  let currentScope: LayoutScope | undefined;
  const scopeListeners = new Set<(scope: LayoutScope | undefined) => void>();
  const frame = input.frame ?? classicFrame;
  const persisted = input.persistence?.getLayout(currentScope);
  const initialLayout = persisted ? mergeWithDefaultAreas(persisted, frame) : createDefaultWorkbenchLayout(frame);

  const store = createWorkbenchStore<WorkbenchLayoutStoreState>({
    name: "workbench.layout",
    initialState: { frame, layout: initialLayout, widgets: {}, placeholders: {} },
  });

  const getFrame = () => store.getState().frame;
  const getLayout = () => store.getState().layout;
  const getPlaceholders = () => store.getState().placeholders;
  const getWidgets = () => store.getState().widgets;
  const getPlaceholder = (areaId: WorkbenchArea) => getPlaceholders()[areaId];
  const requireArea = (areaId: SlotId) => {
    const area = getLayout().areas[areaId];
    if (!area) throw new Error(`Workbench area not found: ${areaId}`);
    return area;
  };
  const areaQueries = createAreaQueries({ getLayout, getWidgets, getPlaceholder, requireArea });
  const contributionLists = createContributionLists({ getPlaceholders, getWidgets });

  const persistLayout = () => {
    input.persistence?.setLayout(getLayout(), currentScope);
  };

  const requireWidget = (id: string) => {
    const widget = getWidgets()[id];
    if (!widget) throw new Error(`Widget not registered: ${id}`);
    return widget;
  };

  const setLayout = (layout: WorkbenchLayout) => {
    const snapshot = store.getState();
    if (snapshot.layout === layout) return;
    store.setState({ ...snapshot, layout }, false, "setLayout");
  };

  const updateNode = (areaId: SlotId, update: (node: WorkbenchLayoutNode) => WorkbenchLayoutNode) => {
    const layout = getLayout();
    const node = layout.nodes[areaId] ?? {};
    const nextNode = update(node);
    if (nextNode === node) return;
    setLayout({ ...layout, nodes: { ...layout.nodes, [areaId]: nextNode } });
    persistLayout();
  };

  const applyAndActivate = (layout: WorkbenchLayout, areaId: SlotId, placement: WorkbenchWidgetPlacement) => {
    setLayout(activateInLayout(layout, areaId, placement));
    persistLayout();
    return placement;
  };

  const contributionRegistrations = createContributionRegistrations({
    store,
    getPlaceholders,
    getWidgets,
    persistLayout,
  });
  const widgetOpeners = createWidgetOpeners({ getLayout, requireArea, requireWidget, applyAndActivate });

  return {
    store,

    getFrame,

    registerPlaceholder: contributionRegistrations.registerPlaceholder,

    registerWidget: contributionRegistrations.registerWidget,

    unregisterWidget(id, options = {}) {
      const current = store.getState();
      if (!current.widgets[id]) return;
      const { [id]: _removed, ...nextWidgets } = current.widgets;
      const nextLayout =
        options.removePlacements === false ? current.layout : removePlacementsForContribution(current.layout, id);
      store.setState({ ...current, widgets: nextWidgets, layout: nextLayout }, false, "unregisterWidget");
      if (options.persist !== false) persistLayout();
    },

    getWidget(id) {
      return getWidgets()[id];
    },

    getPlaceholder,

    getAreaSize: areaQueries.getAreaSize,
    getAreaCollapsible: areaQueries.getAreaCollapsible,
    getAreaHeaderBorderBottom: areaQueries.getAreaHeaderBorderBottom,

    setAreaVisible(areaId, visible) {
      updateNode(areaId, (node) => (node.collapsed === !visible ? node : { ...node, collapsed: !visible }));
    },

    setAreaSize(areaId, size) {
      updateNode(areaId, (node) => (node.size === size ? node : { ...node, size }));
    },

    listPlaceholders: contributionLists.listPlaceholders,
    listWidgets: contributionLists.listWidgets,
    openWidget: widgetOpeners.openWidget,

    updateWidgetPlacement(widgetId, update) {
      const layout = getLayout();
      for (const area of Object.values(layout.areas)) {
        const index = area.widgets.findIndex((placement) => placement.widgetId === widgetId);
        const placement = area.widgets[index];
        if (!placement) continue;

        const widget = requireWidget(placement.contributionId);
        const nextPlacement = buildUpdatedPlacement(placement, widget, update);
        const nextLayout = replaceAreaWidgets(layout, area.id, (widgets) =>
          widgets.map((current, currentIndex) => (currentIndex === index ? nextPlacement : current)),
        );
        setLayout(nextLayout);
        persistLayout();
        return nextPlacement;
      }

      throw new Error(`Widget placement not found: ${widgetId}`);
    },

    activateWidget(widgetId) {
      const layout = getLayout();
      for (const area of Object.values(layout.areas)) {
        const placement = area.widgets.find((candidate) => candidate.widgetId === widgetId);
        if (placement) return applyAndActivate(layout, area.id, placement);
      }
      throw new Error(`Widget placement not found: ${widgetId}`);
    },

    closeWidget(widgetId) {
      const result = closeWidgetInLayout(getLayout(), widgetId);
      if (!result) throw new Error(`Widget placement not found: ${widgetId}`);
      if (result.closedPlacement.closable !== true) throw new Error(`Widget cannot be closed: ${widgetId}`);

      setLayout(result.layout);
      persistLayout();
      return result.activePlacement;
    },

    removeWidgetPlacement(widgetId) {
      const result = closeWidgetInLayout(getLayout(), widgetId);
      if (!result) return undefined;
      setLayout(result.layout);
      persistLayout();
      return result.activePlacement;
    },

    clearArea(areaId) {
      const layout = getLayout();
      const area = requireArea(areaId);

      const cleared: WorkbenchLayout = {
        ...layout,
        areas: { ...layout.areas, [areaId]: { ...area, widgets: [], activeWidgetId: undefined } },
      };
      const next =
        layout.activeSlotId === areaId
          ? { ...cleared, activeSlotId: undefined, activeResourceUri: undefined }
          : cleared;

      setLayout(next);
      persistLayout();
    },

    resetAreas() {
      const layout = getLayout();
      const nextAreas = {} as WorkbenchLayout["areas"];
      for (const [id, area] of Object.entries(layout.areas)) {
        nextAreas[id] = { ...area, widgets: [], activeWidgetId: undefined };
      }
      setLayout({ ...layout, areas: nextAreas, activeSlotId: undefined, activeResourceUri: undefined });
      persistLayout();
    },

    getLayout,

    restoreLayout(layout) {
      setLayout(mergeWithDefaultAreas(layout, getFrame()));
      persistLayout();
    },

    setPersistenceScope(nextScope) {
      if (currentScope === nextScope) return;
      input.persistence?.setLayout(getLayout(), currentScope);
      currentScope = nextScope;
      const incoming = input.persistence?.getLayout(currentScope);
      const currentFrame = getFrame();
      const nextLayout = incoming
        ? mergeWithDefaultAreas(incoming, currentFrame)
        : createDefaultWorkbenchLayout(currentFrame);
      const snapshot = store.getState();
      store.setState({ ...snapshot, layout: nextLayout }, false, "setPersistenceScope");
      for (const listener of scopeListeners) listener(currentScope);
    },

    getPersistenceScope: () => currentScope,

    onDidChangePersistenceScope(listener) {
      scopeListeners.add(listener);
      return createDisposable(() => scopeListeners.delete(listener));
    },
  };
};
