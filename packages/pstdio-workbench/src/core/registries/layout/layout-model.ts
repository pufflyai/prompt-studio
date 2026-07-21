import {
  byContributionPriority,
  type ContributionMetadata,
  normalizeContributionMetadata,
} from "../../shared/contributions/metadata";
import { createDisposable } from "../../shared/disposable";
import {
  createWorkbenchStore,
  type InternalWorkbenchStore,
  type WorkbenchStore,
} from "../../shared/store/workbench-store";
import {
  activateInLayout,
  buildUpdatedPlacement,
  closeWidgetInLayout,
  createPlacement,
  createUniqueWidgetId,
  findPlacement,
  findResourcePlacement,
  getActivePlacement,
  removePlacementsForContribution,
  replaceRegionWidgets,
} from "./layout-operations";
import {
  createDefaultWorkbenchLayout,
  mergeWithDefaultRegions,
  type OpenWidgetInput,
  type PlaceholderContribution,
  type RegisteredPlaceholderContribution,
  type RegisteredWidgetContribution,
  type WidgetContribution,
  type WorkbenchLayout,
  type WorkbenchLayoutStoreState,
  type WorkbenchRegion,
  type WorkbenchRegionSize,
  type WorkbenchRegionState,
  type WorkbenchWidgetPlacement,
} from "./layout-types";

export type {
  OpenWidgetInput,
  PlaceholderContribution,
  RegisteredPlaceholderContribution,
  RegisteredWidgetContribution,
  WidgetContribution,
  WidgetMountStrategy,
  WidgetReusePolicy,
  WorkbenchLayout,
  WorkbenchLayoutStoreState,
  WorkbenchPanelRegion,
  WorkbenchRegion,
  WorkbenchRegionSize,
  WorkbenchRegionState,
  WorkbenchWidgetPlacement,
  WorkbenchWidgetTab,
} from "./layout-types";
export { createDefaultWorkbenchLayout, workbenchPanelRegions, workbenchRegions } from "./layout-types";

export type LayoutScope = string;

export interface LayoutPersistenceAdapter {
  // `scope` undefined → global slot (current behavior).
  getLayout(scope?: LayoutScope): WorkbenchLayout | undefined;
  setLayout(layout: WorkbenchLayout, scope?: LayoutScope): void;
}

export interface CreateLayoutModelInput {
  persistence?: LayoutPersistenceAdapter;
}

export interface LayoutModel {
  store: WorkbenchStore<WorkbenchLayoutStoreState>;
  registerPlaceholder(placeholder: PlaceholderContribution, metadata?: ContributionMetadata): { dispose(): void };
  registerWidget(widget: WidgetContribution, metadata?: ContributionMetadata): { dispose(): void };
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
  activateWidget(widgetId: string): WorkbenchWidgetPlacement;
  closeWidget(widgetId: string): WorkbenchWidgetPlacement | undefined;
  removeWidgetPlacement(widgetId: string): WorkbenchWidgetPlacement | undefined;
  clearRegion(regionId: WorkbenchRegion): void;
  resetRegions(): void;
  getLayout(): WorkbenchLayout;
  restoreLayout(layout: WorkbenchLayout): void;
  setPersistenceScope(scope: LayoutScope | undefined): void;
  getPersistenceScope(): LayoutScope | undefined;
  onDidChangePersistenceScope(listener: (scope: LayoutScope | undefined) => void): { dispose(): void };
}

interface CreateRegionQueriesInput {
  getLayout(): WorkbenchLayout;
  getWidgets(): WorkbenchLayoutStoreState["widgets"];
  getPlaceholder(regionId: WorkbenchRegion): RegisteredPlaceholderContribution | undefined;
}

interface CreateContributionListsInput {
  getPlaceholders(): WorkbenchLayoutStoreState["placeholders"];
  getWidgets(): WorkbenchLayoutStoreState["widgets"];
}

interface CreateContributionRegistrationsInput {
  store: InternalWorkbenchStore<WorkbenchLayoutStoreState>;
  getPlaceholders(): WorkbenchLayoutStoreState["placeholders"];
  getWidgets(): WorkbenchLayoutStoreState["widgets"];
  persistLayout(): void;
}

interface CreateWidgetOpenersInput {
  getLayout(): WorkbenchLayout;
  requireWidget(id: string): RegisteredWidgetContribution;
  applyAndActivate(
    layout: WorkbenchLayout,
    regionId: WorkbenchRegion,
    placement: WorkbenchWidgetPlacement,
  ): WorkbenchWidgetPlacement;
}

const createRegionQueries = (input: CreateRegionQueriesInput) => {
  const { getLayout, getWidgets, getPlaceholder } = input;

  return {
    getRegionSize(regionId: WorkbenchRegion) {
      const persistedSize = getLayout().regions[regionId].size;
      const placement = getActivePlacement(getLayout().regions[regionId]);
      const contributionSize = placement
        ? getWidgets()[placement.contributionId]?.regionSize
        : getPlaceholder(regionId)?.regionSize;
      if (persistedSize === undefined) return contributionSize;
      return { ...contributionSize, defaultPx: persistedSize };
    },

    getRegionCollapsible(regionId: WorkbenchRegion) {
      const placement = getActivePlacement(getLayout().regions[regionId]);
      if (!placement) return getPlaceholder(regionId)?.regionCollapsible ?? true;
      return getWidgets()[placement.contributionId]?.regionCollapsible ?? true;
    },

    getRegionHeaderBorderBottom(regionId: WorkbenchRegion) {
      const placement = getActivePlacement(getLayout().regions[regionId]);
      if (!placement) return true;
      return getWidgets()[placement.contributionId]?.headerBorderBottom ?? true;
    },
  };
};

const createContributionLists = (input: CreateContributionListsInput) => {
  const { getPlaceholders, getWidgets } = input;

  return {
    listPlaceholders() {
      return Object.values(getPlaceholders()).sort(byContributionPriority);
    },

    listWidgets() {
      return Object.values(getWidgets()).sort(byContributionPriority);
    },
  };
};

const createContributionRegistrations = (input: CreateContributionRegistrationsInput) => {
  const { store, getPlaceholders, getWidgets, persistLayout } = input;

  return {
    registerPlaceholder(placeholder: PlaceholderContribution, metadata?: ContributionMetadata) {
      const placeholdersBefore = getPlaceholders();
      if (placeholdersBefore[placeholder.region]) {
        throw new Error(`Placeholder already registered: ${placeholder.region}`);
      }

      const { priority, ...placeholderContribution } = placeholder;
      const record: RegisteredPlaceholderContribution = {
        ...placeholderContribution,
        ...normalizeContributionMetadata({ ...metadata, priority: metadata?.priority ?? priority }),
      };

      const snapshot = store.getState();
      store.setState(
        { ...snapshot, placeholders: { ...snapshot.placeholders, [placeholder.region]: record } },
        false,
        "registerPlaceholder",
      );

      return createDisposable(() => {
        const current = store.getState();
        if (current.placeholders[placeholder.region] !== record) return;

        const { [placeholder.region]: _removed, ...nextPlaceholders } = current.placeholders;
        store.setState({ ...current, placeholders: nextPlaceholders }, false, "unregisterPlaceholder");
      });
    },

    registerWidget(widget: WidgetContribution, metadata?: ContributionMetadata) {
      const widgetsBefore = getWidgets();
      if (widgetsBefore[widget.id]) throw new Error(`Widget already registered: ${widget.id}`);

      const { priority, reuse, singleton, ...widgetContribution } = widget;
      const record: RegisteredWidgetContribution = {
        ...widgetContribution,
        reuse: reuse ?? "resource",
        // Panels are singleton by default; widgets opt into tabbed placements
        // by declaring `singleton: false`.
        singleton: singleton ?? true,
        ...normalizeContributionMetadata({ ...metadata, priority: metadata?.priority ?? priority }),
      };

      const snapshot = store.getState();
      store.setState({ ...snapshot, widgets: { ...snapshot.widgets, [widget.id]: record } }, false, "registerWidget");

      return createDisposable(() => {
        const current = store.getState();
        if (current.widgets[widget.id] !== record) return;

        const { [widget.id]: _removed, ...nextWidgets } = current.widgets;
        const nextLayout = removePlacementsForContribution(current.layout, widget.id);
        store.setState({ widgets: nextWidgets, layout: nextLayout }, false, "unregisterWidget");
        persistLayout();
      });
    },
  };
};

const findReusablePlacement = (
  widget: RegisteredWidgetContribution,
  layout: WorkbenchLayout,
  openInput: OpenWidgetInput,
) => {
  if (widget.singleton) return findPlacement(layout, widget.id);
  if (widget.reuse === "none") return undefined;
  if (openInput.resource) return findResourcePlacement(layout, widget.id, openInput.resource.uri);
  return findPlacement(layout, widget.id);
};

const createWidgetOpeners = (input: CreateWidgetOpenersInput) => {
  const { getLayout, requireWidget, applyAndActivate } = input;

  const updateSingleton = (
    widget: RegisteredWidgetContribution,
    existing: NonNullable<ReturnType<typeof findPlacement>>,
    openInput: OpenWidgetInput,
  ): WorkbenchWidgetPlacement => {
    const nextPlacement = buildUpdatedPlacement(existing.placement, widget, openInput);
    const layout = replaceRegionWidgets(getLayout(), existing.regionId, (widgets) =>
      widgets.map((current, index) => (index === existing.index ? nextPlacement : current)),
    );
    return applyAndActivate(layout, existing.regionId, nextPlacement);
  };

  const replaceActive = (
    widget: RegisteredWidgetContribution,
    regionId: WorkbenchRegion,
    replacementIndex: number,
    replacement: WorkbenchWidgetPlacement,
    openInput: OpenWidgetInput,
  ): WorkbenchWidgetPlacement => {
    const nextPlacement = buildUpdatedPlacement(replacement, widget, openInput);
    const layout = replaceRegionWidgets(getLayout(), regionId, (widgets) =>
      widgets.map((current, index) => (index === replacementIndex ? nextPlacement : current)),
    );
    return applyAndActivate(layout, regionId, nextPlacement);
  };

  const reuseExistingPlacement = (
    widget: RegisteredWidgetContribution,
    existing: NonNullable<ReturnType<typeof findPlacement>>,
    regionId: WorkbenchRegion,
    replacementIndex: number,
    openInput: OpenWidgetInput,
  ) => {
    if (existing.regionId !== regionId) {
      const nextPlacement = buildUpdatedPlacement(existing.placement, widget, openInput);
      const withoutExisting = replaceRegionWidgets(
        getLayout(),
        existing.regionId,
        (widgets) => widgets.filter((_current, index) => index !== existing.index),
        { clearActiveWidget: getLayout().regions[existing.regionId].activeWidgetId === existing.placement.widgetId },
      );
      const layout = replaceRegionWidgets(withoutExisting, regionId, (widgets) => {
        if (replacementIndex < 0) return [...widgets, nextPlacement];
        const copy = [...widgets];
        copy.splice(replacementIndex, 1, nextPlacement);
        return copy;
      });
      return applyAndActivate(layout, regionId, nextPlacement);
    }

    if (replacementIndex < 0 || existing.index === replacementIndex) {
      return updateSingleton(widget, existing, openInput);
    }

    const nextPlacement = buildUpdatedPlacement(existing.placement, widget, openInput);
    const layout = replaceRegionWidgets(getLayout(), regionId, (widgets) =>
      widgets
        .map((current, index) => (index === existing.index ? nextPlacement : current))
        .filter((_current, index) => index !== replacementIndex),
    );
    return applyAndActivate(layout, regionId, nextPlacement);
  };

  const insertWidget = (
    widget: RegisteredWidgetContribution,
    regionId: WorkbenchRegion,
    replacementIndex: number,
    openInput: OpenWidgetInput,
  ): WorkbenchWidgetPlacement => {
    const widgetId = createUniqueWidgetId(getLayout(), widget.id);
    const placement = createPlacement(widgetId, widget, openInput);

    const layout = replaceRegionWidgets(getLayout(), regionId, (widgets) => {
      if (replacementIndex >= 0) {
        const copy = [...widgets];
        copy.splice(replacementIndex, 1, placement);
        return copy;
      }
      return [...widgets, placement];
    });
    return applyAndActivate(layout, regionId, placement);
  };

  const openWidget: LayoutModel["openWidget"] = (id, openInput = {}) => {
    const widget = requireWidget(id);
    const layout = getLayout();
    const regionId = openInput.region ?? widget.region ?? widget.fallbackRegion ?? "main";
    const region = layout.regions[regionId];
    const replacementIndex = openInput.replaceActive
      ? region.widgets.findIndex((placement) => placement.widgetId === region.activeWidgetId && !placement.pinned)
      : -1;
    const replacement = replacementIndex >= 0 ? region.widgets[replacementIndex] : undefined;

    const existing = findReusablePlacement(widget, layout, openInput);
    if (existing) return reuseExistingPlacement(widget, existing, regionId, replacementIndex, openInput);

    if (replacement?.contributionId === widget.id) {
      return replaceActive(widget, regionId, replacementIndex, replacement, openInput);
    }

    return insertWidget(widget, regionId, replacementIndex, openInput);
  };

  return { openWidget };
};

export const createLayoutModel = (input: CreateLayoutModelInput = {}): LayoutModel => {
  let currentScope: LayoutScope | undefined;
  const scopeListeners = new Set<(scope: LayoutScope | undefined) => void>();
  const persisted = input.persistence?.getLayout(currentScope);
  const initialLayout = persisted ? mergeWithDefaultRegions(persisted) : createDefaultWorkbenchLayout();

  const store = createWorkbenchStore<WorkbenchLayoutStoreState>({
    name: "workbench.layout",
    initialState: { layout: initialLayout, widgets: {}, placeholders: {} },
  });

  const getLayout = () => store.getState().layout;
  const getPlaceholders = () => store.getState().placeholders;
  const getWidgets = () => store.getState().widgets;
  const getPlaceholder = (regionId: WorkbenchRegion) => getPlaceholders()[regionId];
  const regionQueries = createRegionQueries({ getLayout, getWidgets, getPlaceholder });
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

  const updateRegion = (regionId: WorkbenchRegion, update: (region: WorkbenchRegionState) => WorkbenchRegionState) => {
    const layout = getLayout();
    const region = layout.regions[regionId];
    const nextRegion = update(region);
    if (nextRegion === region) return;
    setLayout({ ...layout, regions: { ...layout.regions, [regionId]: nextRegion } });
    persistLayout();
  };

  const applyAndActivate = (
    layout: WorkbenchLayout,
    regionId: WorkbenchRegion,
    placement: WorkbenchWidgetPlacement,
  ) => {
    setLayout(activateInLayout(layout, regionId, placement));
    persistLayout();
    return placement;
  };

  const contributionRegistrations = createContributionRegistrations({
    store,
    getPlaceholders,
    getWidgets,
    persistLayout,
  });
  const widgetOpeners = createWidgetOpeners({ getLayout, requireWidget, applyAndActivate });

  return {
    store,

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

    getRegionSize: regionQueries.getRegionSize,
    getRegionCollapsible: regionQueries.getRegionCollapsible,
    getRegionHeaderBorderBottom: regionQueries.getRegionHeaderBorderBottom,

    setRegionVisible(regionId, visible) {
      updateRegion(regionId, (region) => (region.visible === visible ? region : { ...region, visible }));
    },

    setRegionSize(regionId, size) {
      updateRegion(regionId, (region) => (region.size === size ? region : { ...region, size }));
    },

    listPlaceholders: contributionLists.listPlaceholders,
    listWidgets: contributionLists.listWidgets,
    openWidget: widgetOpeners.openWidget,

    updateWidgetPlacement(widgetId, update) {
      const layout = getLayout();
      for (const region of Object.values(layout.regions)) {
        const index = region.widgets.findIndex((placement) => placement.widgetId === widgetId);
        if (index < 0) continue;

        const widget = requireWidget(region.widgets[index].contributionId);
        const nextPlacement = buildUpdatedPlacement(region.widgets[index], widget, update);
        const nextLayout = replaceRegionWidgets(layout, region.id, (widgets) =>
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
      for (const region of Object.values(layout.regions)) {
        const placement = region.widgets.find((candidate) => candidate.widgetId === widgetId);
        if (placement) return applyAndActivate(layout, region.id, placement);
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

    clearRegion(regionId) {
      const layout = getLayout();
      const region = layout.regions[regionId];
      const activeWidgetId = region.activeWidgetId;

      const cleared: WorkbenchLayout = {
        ...layout,
        regions: { ...layout.regions, [regionId]: { ...region, widgets: [], activeWidgetId: undefined } },
      };
      const next =
        activeWidgetId && layout.activeWidgetId === activeWidgetId
          ? { ...cleared, activeWidgetId: undefined, activeResourceUri: undefined }
          : cleared;

      setLayout(next);
      persistLayout();
    },

    resetRegions() {
      const layout = getLayout();
      const nextRegions = {} as WorkbenchLayout["regions"];
      for (const [id, region] of Object.entries(layout.regions) as [WorkbenchRegion, WorkbenchRegionState][]) {
        nextRegions[id] = { ...region, widgets: [], activeWidgetId: undefined };
      }
      setLayout({ regions: nextRegions, activeWidgetId: undefined, activeResourceUri: undefined });
      persistLayout();
    },

    getLayout,

    restoreLayout(layout) {
      setLayout(mergeWithDefaultRegions(layout));
      persistLayout();
    },

    setPersistenceScope(nextScope) {
      if (currentScope === nextScope) return;
      input.persistence?.setLayout(getLayout(), currentScope);
      currentScope = nextScope;
      const incoming = input.persistence?.getLayout(currentScope);
      const nextLayout = incoming ? mergeWithDefaultRegions(incoming) : createDefaultWorkbenchLayout();
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
