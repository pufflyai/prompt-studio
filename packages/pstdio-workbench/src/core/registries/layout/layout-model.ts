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
  getActiveLocationPlacement,
  getActivePlacement,
  removePlacementsForContribution,
  replaceRegionWidgets,
  setLocationSubPanelSelection,
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
  type WorkbenchLocationContribution,
  type WorkbenchPanelMenuContribution,
  type WorkbenchPanelRegion,
  type WorkbenchRegion,
  type WorkbenchRegionSize,
  type WorkbenchRegionState,
  type WorkbenchSubPanelContribution,
  type WorkbenchWidgetPlacement,
  workbenchPanelRegions,
} from "./layout-types";
import { createPanelRegistrations } from "./panel-registration";

export type {
  OpenWidgetInput,
  PlaceholderContribution,
  RegisteredPlaceholderContribution,
  RegisteredWidgetContribution,
  WidgetContribution,
  WidgetMountStrategy,
  WidgetReusePolicy,
  WorkbenchFloatingPanelVisibility,
  WorkbenchLayout,
  WorkbenchLayoutStoreState,
  WorkbenchLocationContribution,
  WorkbenchLocationEligibility,
  WorkbenchPanelMenuContribution,
  WorkbenchPanelMenuDefinition,
  WorkbenchPanelMenuOwner,
  WorkbenchPanelMenuRegion,
  WorkbenchPanelMenuSide,
  WorkbenchPanelRegion,
  WorkbenchRegion,
  WorkbenchRegionSize,
  WorkbenchRegionState,
  WorkbenchSubPanelContribution,
  WorkbenchWidgetPlacement,
  WorkbenchWidgetRole,
  WorkbenchWidgetTab,
} from "./layout-types";
export {
  createDefaultWorkbenchLayout,
  getWorkbenchPanelForMenuRegion,
  workbenchPanelMenuRegions,
  workbenchPanelRegions,
  workbenchRegions,
} from "./layout-types";

export type LayoutScope = string;

export interface LayoutPersistenceAdapter {
  // `scope` undefined → global slot (current behavior).
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

const carryPinnedWorkbenchChrome = (current: WorkbenchLayout, incoming: WorkbenchLayout): WorkbenchLayout => {
  const regions = { ...incoming.regions };

  for (const region of Object.values(current.regions)) {
    const pinned = region.widgets.filter((placement) => placement.pinned && placement.role === "content");
    if (pinned.length === 0) continue;

    const contributionIds = new Set(pinned.map((placement) => placement.contributionId));
    const incomingRegion = incoming.regions[region.id];
    regions[region.id] = {
      ...incomingRegion,
      widgets: [
        ...pinned,
        ...incomingRegion.widgets.filter((placement) => !contributionIds.has(placement.contributionId)),
      ],
      activeWidgetId: incomingRegion.activeWidgetId ?? pinned[0]?.widgetId,
    };
  }

  return { ...incoming, regions };
};

const carryWorkbenchRegionState = (
  current: WorkbenchLayout,
  incoming: WorkbenchLayout,
  regionIds: readonly WorkbenchRegion[],
) => {
  if (regionIds.length === 0) return incoming;
  const regions = { ...incoming.regions };
  for (const regionId of regionIds) regions[regionId] = current.regions[regionId];
  return { ...incoming, regions };
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
        role: widget.role ?? "content",
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
  if (!widget.singleton && widget.reuse === "none") return undefined;
  if (widget.role === "sub-panel" || widget.role === "panel-menu") {
    const ownerResourceUri = getActiveLocationPlacement(layout)?.resourceUri;
    for (const region of Object.values(layout.regions)) {
      const index = region.widgets.findIndex(
        (candidate) =>
          candidate.contributionId === widget.id &&
          candidate.ownerResourceUri === ownerResourceUri &&
          (!openInput.resource || candidate.resourceUri === openInput.resource.uri),
      );
      if (index >= 0) return { regionId: region.id, index, placement: region.widgets[index] };
    }
    return undefined;
  }
  if (widget.singleton) return findPlacement(layout, widget.id);
  if (openInput.resource) return findResourcePlacement(layout, widget.id, openInput.resource.uri);
  return findPlacement(layout, widget.id);
};

const findReplacementIndex = (
  layout: WorkbenchLayout,
  regionId: WorkbenchRegion,
  widget: RegisteredWidgetContribution,
  openInput: OpenWidgetInput,
) => {
  const region = layout.regions[regionId];
  const activeWidgetId = widget.role === "location" ? layout.activeLocationWidgetId : region.activeWidgetId;

  if (openInput.replaceWidgetId) {
    return region.widgets.findIndex((placement) => placement.widgetId === openInput.replaceWidgetId);
  }
  if (!openInput.replaceActive) return -1;
  return region.widgets.findIndex((placement) => placement.widgetId === activeWidgetId && !placement.pinned);
};

const createWidgetOpeners = (input: CreateWidgetOpenersInput) => {
  const { getLayout, requireWidget, applyAndActivate } = input;

  const bindToActiveLocation = (
    placement: WorkbenchWidgetPlacement,
    widget: RegisteredWidgetContribution,
    layout: WorkbenchLayout,
  ) => {
    if (widget.role !== "sub-panel" && widget.role !== "panel-menu") return placement;
    return { ...placement, ownerResourceUri: getActiveLocationPlacement(layout)?.resourceUri };
  };

  const updateSingleton = (
    widget: RegisteredWidgetContribution,
    existing: NonNullable<ReturnType<typeof findPlacement>>,
    openInput: OpenWidgetInput,
  ): WorkbenchWidgetPlacement => {
    const nextPlacement = bindToActiveLocation(
      buildUpdatedPlacement(existing.placement, widget, openInput),
      widget,
      getLayout(),
    );
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
    const nextPlacement = bindToActiveLocation(
      buildUpdatedPlacement(replacement, widget, openInput),
      widget,
      getLayout(),
    );
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
      const nextPlacement = bindToActiveLocation(
        buildUpdatedPlacement(existing.placement, widget, openInput),
        widget,
        getLayout(),
      );
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

    const nextPlacement = bindToActiveLocation(
      buildUpdatedPlacement(existing.placement, widget, openInput),
      widget,
      getLayout(),
    );
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
    const placement = bindToActiveLocation(createPlacement(widgetId, widget, openInput), widget, getLayout());

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
    const replacementIndex = findReplacementIndex(layout, regionId, widget, openInput);
    const replacement = replacementIndex >= 0 ? region.widgets[replacementIndex] : undefined;

    const existing =
      openInput.replaceWidgetId && replacement ? undefined : findReusablePlacement(widget, layout, openInput);
    let placement: WorkbenchWidgetPlacement;
    if (existing) placement = reuseExistingPlacement(widget, existing, regionId, replacementIndex, openInput);
    else if (replacement?.contributionId === widget.id) {
      placement = replaceActive(widget, regionId, replacementIndex, replacement, openInput);
    } else {
      placement = insertWidget(widget, regionId, replacementIndex, openInput);
    }

    for (const panelMenuId of widget.ownedPanelMenuIds ?? []) {
      openWidget(panelMenuId, { pinned: true });
    }

    return applyAndActivate(getLayout(), regionId, placement);
  };

  return { openWidget };
};

const resolveScopedLayout = (input: CreateLayoutModelInput, persisted: WorkbenchLayout | undefined) =>
  persisted
    ? mergeWithDefaultRegions(persisted, input.defaultRegionVisibility)
    : createDefaultWorkbenchLayout(input.defaultRegionVisibility);

const createScopeEvent = () => {
  const listeners = new Set<(scope: LayoutScope | undefined) => void>();
  return {
    notify(scope: LayoutScope | undefined) {
      for (const listener of listeners) listener(scope);
    },
    subscribe(listener: (scope: LayoutScope | undefined) => void) {
      listeners.add(listener);
      return createDisposable(() => listeners.delete(listener));
    },
  };
};

export const createLayoutModel = (input: CreateLayoutModelInput = {}): LayoutModel => {
  let currentScope: LayoutScope | undefined;
  const willChangeScope = createScopeEvent();
  const didChangeScope = createScopeEvent();
  const persisted = input.persistence?.getLayout(currentScope);
  const initialLayout = resolveScopedLayout(input, persisted);

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

  const persistLayout = () => input.persistence?.setLayout(getLayout(), currentScope);

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
  const panelRegistrations = createPanelRegistrations({
    registerWidget: contributionRegistrations.registerWidget,
  });
  const widgetOpeners = createWidgetOpeners({ getLayout, requireWidget, applyAndActivate });

  return {
    store,

    registerPlaceholder: contributionRegistrations.registerPlaceholder,

    registerWidget: contributionRegistrations.registerWidget,

    ...panelRegistrations,

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

    setRegionActiveWidget(regionId, widgetId) {
      const layout = getLayout();
      const region = layout.regions[regionId];
      const placement = widgetId ? region.widgets.find((candidate) => candidate.widgetId === widgetId) : undefined;
      if (widgetId && !placement) throw new Error(`Widget placement not found in ${regionId}: ${widgetId}`);
      if (region.activeWidgetId === widgetId) return;

      const nextLayout = {
        ...layout,
        activeWidgetId: layout.activeWidgetId === region.activeWidgetId ? placement?.widgetId : layout.activeWidgetId,
        activeResourceUri:
          layout.activeWidgetId === region.activeWidgetId ? placement?.resourceUri : layout.activeResourceUri,
        regions: {
          ...layout.regions,
          [regionId]: { ...region, activeWidgetId: placement?.widgetId },
        },
      };
      const withSelection = workbenchPanelRegions.includes(regionId as WorkbenchPanelRegion)
        ? setLocationSubPanelSelection(
            nextLayout,
            getActiveLocationPlacement(nextLayout),
            regionId as WorkbenchPanelRegion,
            placement?.role === "sub-panel" ? placement.widgetId : undefined,
          )
        : nextLayout;
      setLayout(withSelection);
      persistLayout();
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
      let next =
        activeWidgetId && layout.activeWidgetId === activeWidgetId
          ? { ...cleared, activeWidgetId: undefined, activeResourceUri: undefined }
          : cleared;

      if (workbenchPanelRegions.includes(regionId as WorkbenchPanelRegion)) {
        next = setLocationSubPanelSelection(
          next,
          getActiveLocationPlacement(next),
          regionId as WorkbenchPanelRegion,
          undefined,
        );
      }

      setLayout(next);
      persistLayout();
    },

    resetRegions() {
      const layout = getLayout();
      const nextRegions = {} as WorkbenchLayout["regions"];
      for (const [id, region] of Object.entries(layout.regions) as [WorkbenchRegion, WorkbenchRegionState][]) {
        nextRegions[id] = { ...region, widgets: [], activeWidgetId: undefined };
      }
      setLayout({
        regions: nextRegions,
        locationSubPanelSelections: {},
        activeWidgetId: undefined,
        activeLocationWidgetId: undefined,
        activeResourceUri: undefined,
      });
      persistLayout();
    },

    getLayout,

    restoreLayout(layout) {
      setLayout(mergeWithDefaultRegions(layout, input.defaultRegionVisibility));
      persistLayout();
    },

    setPersistenceScope(nextScope, scopeInput = {}) {
      if (currentScope === nextScope) return;
      input.persistence?.setLayout(getLayout(), currentScope);
      willChangeScope.notify(nextScope);
      currentScope = nextScope;
      const incoming = input.persistence?.getLayout(currentScope);
      const scopedLayout = resolveScopedLayout(input, incoming);
      // Module-owned chrome is global workbench structure. Project scopes replace
      // Location workspaces, but must not unmount pinned navigation and headers.
      const withPinnedChrome = carryPinnedWorkbenchChrome(getLayout(), scopedLayout);
      const nextLayout = carryWorkbenchRegionState(getLayout(), withPinnedChrome, scopeInput.carryRegionState ?? []);
      const snapshot = store.getState();
      store.setState({ ...snapshot, layout: nextLayout }, false, "setPersistenceScope");
      didChangeScope.notify(currentScope);
    },

    getPersistenceScope: () => currentScope,

    onWillChangePersistenceScope: willChangeScope.subscribe,
    onDidChangePersistenceScope: didChangeScope.subscribe,
  };
};
