import type { ContributionMetadata } from "../../shared/contributions/metadata";
import { createDisposable } from "../../shared/disposable";
import {
  createWorkbenchStore,
  type InternalWorkbenchStore,
  type WorkbenchStore,
} from "../../shared/store/workbench-store";
import { applyFrameToLayout } from "./apply-frame";
import { classicFrame } from "./classic-frame";
import type { Frame, SlotPresentation } from "./frame-types";
import { createContributionLists, createContributionRegistrations } from "./layout-model-contributions";
import { createWidgetOpeners } from "./layout-model-openers";
import { createAreaQueries } from "./layout-model-queries";
import {
  activateInLayout,
  buildUpdatedPlacement,
  closeWidgetInLayout,
  findPlacementByWidgetId,
  moveWidgetInLayout,
  removePlacementsForContribution,
  replaceAreaWidgets,
} from "./layout-operations";
import { createLayoutPersister } from "./layout-persister";
import { changedLayoutOwners, layoutScopesEqual, persistenceScopes, restoreScopedLayout } from "./layout-scope";
import {
  createDefaultWorkbenchLayout,
  type MoveWidgetInput,
  mergeWithDefaultAreas,
  type OpenWidgetInput,
  type PlaceholderContribution,
  type RegisteredPlaceholderContribution,
  type RegisteredWidgetContribution,
  type SlotId,
  type WidgetContribution,
  type WorkbenchAreaSize,
  type WorkbenchLayout,
  type WorkbenchLayoutNode,
  type WorkbenchLayoutStoreState,
  type WorkbenchWidgetPlacement,
} from "./layout-types";

export type {
  MoveWidgetInput,
  OpenWidgetInput,
  PanelMenuBinding,
  PanelMenuSide,
  PlaceholderContribution,
  RegisteredPlaceholderContribution,
  RegisteredWidgetContribution,
  SlotId,
  WidgetContribution,
  WidgetMountStrategy,
  WidgetReusePolicy,
  WorkbenchAreaSize,
  WorkbenchAreaState,
  WorkbenchLayout,
  WorkbenchLayoutNode,
  WorkbenchLayoutStoreState,
  WorkbenchWidgetPlacement,
} from "./layout-types";
export { createDefaultWorkbenchLayout } from "./layout-types";

export interface LayoutScope {
  mode: string;
  resource?: string;
}

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
  getDefaultFrame(): Frame;
  setFrame(frame: Frame): void;
  registerPlaceholder(placeholder: PlaceholderContribution, metadata?: ContributionMetadata): { dispose(): void };
  registerWidget(widget: WidgetContribution, metadata?: ContributionMetadata): { dispose(): void };
  unregisterWidget(id: string, options?: { removePlacements?: boolean; persist?: boolean }): void;
  getPlaceholder(areaId: SlotId): RegisteredPlaceholderContribution | undefined;
  getWidget(id: string): RegisteredWidgetContribution | undefined;
  getAreaSize(areaId: SlotId): WorkbenchAreaSize | undefined;
  getAreaCollapsible(areaId: SlotId): boolean;
  getAreaHeaderBorderBottom(areaId: SlotId): boolean;
  getAreaPresentation(areaId: SlotId): SlotPresentation | undefined;
  setAreaVisible(areaId: SlotId, visible: boolean): void;
  setAreaSize(areaId: SlotId, size: number): void;
  setAreaPresentation(areaId: SlotId, presentation: SlotPresentation): void;
  listPlaceholders(): RegisteredPlaceholderContribution[];
  listWidgets(): RegisteredWidgetContribution[];
  openWidget(id: string, input?: OpenWidgetInput): WorkbenchWidgetPlacement;
  moveWidget(widgetId: string, input: MoveWidgetInput): WorkbenchWidgetPlacement | undefined;
  updateWidgetPlacement(widgetId: string, input: OpenWidgetInput): WorkbenchWidgetPlacement;
  activateWidget(widgetId: string): WorkbenchWidgetPlacement;
  closeWidget(widgetId: string): WorkbenchWidgetPlacement | undefined;
  removeWidgetPlacement(widgetId: string): WorkbenchWidgetPlacement | undefined;
  clearArea(areaId: SlotId): void;
  resetAreas(): void;
  getLayout(): WorkbenchLayout;
  restoreLayout(layout: WorkbenchLayout): void;
  persist(): void;
  hasPersistedLayout(scope?: LayoutScope): boolean;
  setPersistenceScope(scope: LayoutScope | undefined): void;
  getPersistenceScope(): LayoutScope | undefined;
  onDidChangePersistenceScope(
    listener: (scope: LayoutScope | undefined, owners: readonly ("project" | "resource")[]) => void,
  ): { dispose(): void };
}

interface CreateFrameControllerInput {
  defaultFrame: Frame;
  store: InternalWorkbenchStore<WorkbenchLayoutStoreState>;
  persistLayout(): void;
}

const createFrameController = (input: CreateFrameControllerInput) => ({
  getDefaultFrame: () => input.defaultFrame,
  setFrame(frame: Frame) {
    const snapshot = input.store.getState();
    if (snapshot.frame === frame) return;
    input.store.setState({ ...snapshot, frame, layout: applyFrameToLayout(snapshot.layout, frame) }, false, "setFrame");
    input.persistLayout();
  },
});

const createAreaEnsurer =
  (getLayout: () => WorkbenchLayout, setLayout: (layout: WorkbenchLayout) => void) => (areaId: SlotId) => {
    const layout = getLayout();
    const existing = layout.areas[areaId] ?? layout.orphans?.[areaId];
    if (existing) return existing;

    const area = { id: areaId, widgets: [] };
    setLayout({ ...layout, orphans: { ...layout.orphans, [areaId]: area } });
    return area;
  };

type LayoutScopeChangeListener = (scope: LayoutScope | undefined, owners: readonly ("project" | "resource")[]) => void;

const createInitialLayout = (input: CreateLayoutModelInput, frame: Frame) => {
  const persisted = input.persistence?.getLayout();
  return persisted ? mergeWithDefaultAreas(persisted, frame) : createDefaultWorkbenchLayout(frame);
};

export const createLayoutModel = (input: CreateLayoutModelInput = {}): LayoutModel => {
  let currentScope: LayoutScope | undefined;
  const scopeListeners = new Set<LayoutScopeChangeListener>();
  const defaultFrame = input.frame ?? classicFrame;
  const initialLayout = createInitialLayout(input, defaultFrame);

  const store = createWorkbenchStore<WorkbenchLayoutStoreState>({
    name: "workbench.layout",
    initialState: { frame: defaultFrame, layout: initialLayout, widgets: {}, placeholders: {} },
  });

  const getFrame = () => store.getState().frame;
  const getLayout = () => store.getState().layout;
  const getPlaceholders = () => store.getState().placeholders;
  const getWidgets = () => store.getState().widgets;
  const getPlaceholder = (areaId: SlotId) => getPlaceholders()[areaId];
  const requireArea = (areaId: SlotId) => {
    const area = getLayout().areas[areaId];
    if (!area) throw new Error(`Workbench area not found: ${areaId}`);
    return area;
  };
  const areaQueries = createAreaQueries({ getLayout, getWidgets, getPlaceholder, requireArea });
  const contributionLists = createContributionLists({ getPlaceholders, getWidgets });
  const persister = createLayoutPersister(input.persistence);

  const persistLayout = () => {
    persister.schedule(getLayout(), persistenceScopes(currentScope));
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

  const ensureArea = createAreaEnsurer(getLayout, setLayout);

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

  const applyWithoutActivation = (layout: WorkbenchLayout, placement: WorkbenchWidgetPlacement) => {
    setLayout(layout);
    persistLayout();
    return placement;
  };

  const contributionRegistrations = createContributionRegistrations({
    store,
    getPlaceholders,
    getWidgets,
    persistLayout,
  });
  const widgetOpeners = createWidgetOpeners({
    getLayout,
    ensureArea,
    isAreaActive: (areaId) => Boolean(getLayout().areas[areaId]),
    requireWidget,
    applyAndActivate,
    applyWithoutActivation,
  });
  const frameController = createFrameController({ defaultFrame, store, persistLayout });

  return {
    store,

    getFrame,
    ...frameController,

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

    getAreaPresentation(areaId) {
      return getLayout().nodes[areaId]?.presentation;
    },

    setAreaVisible(areaId, visible) {
      updateNode(areaId, (node) => (node.collapsed === !visible ? node : { ...node, collapsed: !visible }));
    },

    setAreaSize(areaId, size) {
      updateNode(areaId, (node) => (node.size === size ? node : { ...node, size }));
    },

    setAreaPresentation(areaId, presentation) {
      updateNode(areaId, (node) => (node.presentation === presentation ? node : { ...node, presentation }));
    },

    listPlaceholders: contributionLists.listPlaceholders,
    listWidgets: contributionLists.listWidgets,
    openWidget: widgetOpeners.openWidget,

    moveWidget(widgetId, moveInput) {
      const found = findPlacementByWidgetId(getLayout(), widgetId);
      if (!found) return undefined;
      if (found.areaId !== moveInput.areaId && moveInput.areaId === getFrame().primary) {
        throw new Error(`Cannot move a widget into the primary slot: ${moveInput.areaId}`);
      }

      const result = moveWidgetInLayout(getLayout(), widgetId, moveInput);
      if (!result) return undefined;
      setLayout(result.layout);
      persistLayout();
      return result.placement;
    },

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

    persist() {
      persistLayout();
      persister.flush();
    },

    hasPersistedLayout(scope = currentScope) {
      return input.persistence?.getLayout(scope) !== undefined;
    },

    setPersistenceScope(nextScope) {
      if (layoutScopesEqual(currentScope, nextScope)) return;
      persister.flush();
      const previousScope = currentScope;
      currentScope = nextScope;
      const changedOwners = changedLayoutOwners(previousScope, nextScope);
      const nextLayout = restoreScopedLayout({
        current: getLayout(),
        currentScope: previousScope,
        nextScope,
        frame: getFrame(),
        persistence: input.persistence,
      });
      const snapshot = store.getState();
      store.setState({ ...snapshot, layout: nextLayout }, false, "setPersistenceScope");
      for (const listener of scopeListeners) listener(currentScope, changedOwners);
    },

    getPersistenceScope: () => currentScope,

    onDidChangePersistenceScope(listener) {
      scopeListeners.add(listener);
      return createDisposable(() => scopeListeners.delete(listener));
    },
  };
};
