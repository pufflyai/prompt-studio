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
  replaceAreaWidgets,
} from "./layout-operations";
import {
  createDefaultWorkbenchLayout,
  mergeWithDefaultAreas,
  type OpenWidgetInput,
  type PlaceholderContribution,
  type RegisteredPlaceholderContribution,
  type RegisteredWidgetContribution,
  type WidgetContribution,
  type WorkbenchArea,
  type WorkbenchAreaSize,
  type WorkbenchAreaState,
  type WorkbenchLayout,
  type WorkbenchLayoutStoreState,
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
  WorkbenchArea,
  WorkbenchAreaSize,
  WorkbenchAreaState,
  WorkbenchLayout,
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
  persistence?: LayoutPersistenceAdapter;
}

export interface LayoutModel {
  store: WorkbenchStore<WorkbenchLayoutStoreState>;
  registerPlaceholder(placeholder: PlaceholderContribution, metadata?: ContributionMetadata): { dispose(): void };
  registerWidget(widget: WidgetContribution, metadata?: ContributionMetadata): { dispose(): void };
  unregisterWidget(id: string, options?: { removePlacements?: boolean; persist?: boolean }): void;
  getPlaceholder(areaId: WorkbenchArea): RegisteredPlaceholderContribution | undefined;
  getWidget(id: string): RegisteredWidgetContribution | undefined;
  getAreaSize(areaId: WorkbenchArea): WorkbenchAreaSize | undefined;
  getAreaCollapsible(areaId: WorkbenchArea): boolean;
  getAreaHeaderBorderBottom(areaId: WorkbenchArea): boolean;
  setAreaVisible(areaId: WorkbenchArea, visible: boolean): void;
  setAreaSize(areaId: WorkbenchArea, size: number): void;
  listPlaceholders(): RegisteredPlaceholderContribution[];
  listWidgets(): RegisteredWidgetContribution[];
  openWidget(id: string, input?: OpenWidgetInput): WorkbenchWidgetPlacement;
  updateWidgetPlacement(widgetId: string, input: OpenWidgetInput): WorkbenchWidgetPlacement;
  activateWidget(widgetId: string): WorkbenchWidgetPlacement;
  closeWidget(widgetId: string): WorkbenchWidgetPlacement | undefined;
  removeWidgetPlacement(widgetId: string): WorkbenchWidgetPlacement | undefined;
  clearArea(areaId: WorkbenchArea): void;
  resetAreas(): void;
  getLayout(): WorkbenchLayout;
  restoreLayout(layout: WorkbenchLayout): void;
  setPersistenceScope(scope: LayoutScope | undefined): void;
  getPersistenceScope(): LayoutScope | undefined;
  onDidChangePersistenceScope(listener: (scope: LayoutScope | undefined) => void): { dispose(): void };
}

interface CreateAreaQueriesInput {
  getLayout(): WorkbenchLayout;
  getWidgets(): WorkbenchLayoutStoreState["widgets"];
  getPlaceholder(areaId: WorkbenchArea): RegisteredPlaceholderContribution | undefined;
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
    areaId: WorkbenchArea,
    placement: WorkbenchWidgetPlacement,
  ): WorkbenchWidgetPlacement;
}

const createAreaQueries = (input: CreateAreaQueriesInput) => {
  const { getLayout, getWidgets, getPlaceholder } = input;

  return {
    getAreaSize(areaId: WorkbenchArea) {
      const persistedSize = getLayout().areas[areaId].size;
      const placement = getActivePlacement(getLayout().areas[areaId]);
      const contributionSize = placement
        ? getWidgets()[placement.contributionId]?.areaSize
        : getPlaceholder(areaId)?.areaSize;
      if (persistedSize === undefined) return contributionSize;
      return { ...contributionSize, defaultPx: persistedSize };
    },

    getAreaCollapsible(areaId: WorkbenchArea) {
      const placement = getActivePlacement(getLayout().areas[areaId]);
      if (!placement) return getPlaceholder(areaId)?.areaCollapsible ?? true;
      return getWidgets()[placement.contributionId]?.areaCollapsible ?? true;
    },

    getAreaHeaderBorderBottom(areaId: WorkbenchArea) {
      const placement = getActivePlacement(getLayout().areas[areaId]);
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
      if (placeholdersBefore[placeholder.area]) {
        throw new Error(`Placeholder already registered: ${placeholder.area}`);
      }

      const { priority, ...placeholderContribution } = placeholder;
      const record: RegisteredPlaceholderContribution = {
        ...placeholderContribution,
        ...normalizeContributionMetadata({ ...metadata, priority: metadata?.priority ?? priority }),
      };

      const snapshot = store.getState();
      store.setState(
        { ...snapshot, placeholders: { ...snapshot.placeholders, [placeholder.area]: record } },
        false,
        "registerPlaceholder",
      );

      return createDisposable(() => {
        const current = store.getState();
        if (current.placeholders[placeholder.area] !== record) return;

        const { [placeholder.area]: _removed, ...nextPlaceholders } = current.placeholders;
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
    const layout = replaceAreaWidgets(getLayout(), existing.areaId, (widgets) =>
      widgets.map((current, index) => (index === existing.index ? nextPlacement : current)),
    );
    return applyAndActivate(layout, existing.areaId, nextPlacement);
  };

  const replaceActive = (
    widget: RegisteredWidgetContribution,
    areaId: WorkbenchArea,
    replacementIndex: number,
    replacement: WorkbenchWidgetPlacement,
    openInput: OpenWidgetInput,
  ): WorkbenchWidgetPlacement => {
    const nextPlacement = buildUpdatedPlacement(replacement, widget, openInput);
    const layout = replaceAreaWidgets(getLayout(), areaId, (widgets) =>
      widgets.map((current, index) => (index === replacementIndex ? nextPlacement : current)),
    );
    return applyAndActivate(layout, areaId, nextPlacement);
  };

  const reuseExistingPlacement = (
    widget: RegisteredWidgetContribution,
    existing: NonNullable<ReturnType<typeof findPlacement>>,
    areaId: WorkbenchArea,
    replacementIndex: number,
    openInput: OpenWidgetInput,
  ) => {
    if (existing.areaId !== areaId) {
      const nextPlacement = buildUpdatedPlacement(existing.placement, widget, openInput);
      const withoutExisting = replaceAreaWidgets(
        getLayout(),
        existing.areaId,
        (widgets) => widgets.filter((_current, index) => index !== existing.index),
        { clearActiveWidget: getLayout().areas[existing.areaId].activeWidgetId === existing.placement.widgetId },
      );
      const layout = replaceAreaWidgets(withoutExisting, areaId, (widgets) => {
        if (replacementIndex < 0) return [...widgets, nextPlacement];
        const copy = [...widgets];
        copy.splice(replacementIndex, 1, nextPlacement);
        return copy;
      });
      return applyAndActivate(layout, areaId, nextPlacement);
    }

    if (replacementIndex < 0 || existing.index === replacementIndex) {
      return updateSingleton(widget, existing, openInput);
    }

    const nextPlacement = buildUpdatedPlacement(existing.placement, widget, openInput);
    const layout = replaceAreaWidgets(getLayout(), areaId, (widgets) =>
      widgets
        .map((current, index) => (index === existing.index ? nextPlacement : current))
        .filter((_current, index) => index !== replacementIndex),
    );
    return applyAndActivate(layout, areaId, nextPlacement);
  };

  const insertWidget = (
    widget: RegisteredWidgetContribution,
    areaId: WorkbenchArea,
    replacementIndex: number,
    openInput: OpenWidgetInput,
  ): WorkbenchWidgetPlacement => {
    const widgetId = createUniqueWidgetId(getLayout(), widget.id);
    const placement = createPlacement(widgetId, widget, openInput);

    const layout = replaceAreaWidgets(getLayout(), areaId, (widgets) => {
      if (replacementIndex >= 0) {
        const copy = [...widgets];
        copy.splice(replacementIndex, 1, placement);
        return copy;
      }
      return [...widgets, placement];
    });
    return applyAndActivate(layout, areaId, placement);
  };

  const openWidget: LayoutModel["openWidget"] = (id, openInput = {}) => {
    const widget = requireWidget(id);
    const layout = getLayout();
    const areaId = openInput.area ?? widget.area ?? widget.fallbackArea ?? "main";
    const area = layout.areas[areaId];
    const replacementIndex = openInput.replaceActive
      ? area.widgets.findIndex((placement) => placement.widgetId === area.activeWidgetId && !placement.pinned)
      : -1;
    const replacement = replacementIndex >= 0 ? area.widgets[replacementIndex] : undefined;

    const existing = findReusablePlacement(widget, layout, openInput);
    if (existing) return reuseExistingPlacement(widget, existing, areaId, replacementIndex, openInput);

    if (replacement?.contributionId === widget.id) {
      return replaceActive(widget, areaId, replacementIndex, replacement, openInput);
    }

    return insertWidget(widget, areaId, replacementIndex, openInput);
  };

  return { openWidget };
};

export const createLayoutModel = (input: CreateLayoutModelInput = {}): LayoutModel => {
  let currentScope: LayoutScope | undefined;
  const scopeListeners = new Set<(scope: LayoutScope | undefined) => void>();
  const persisted = input.persistence?.getLayout(currentScope);
  const initialLayout = persisted ? mergeWithDefaultAreas(persisted) : createDefaultWorkbenchLayout();

  const store = createWorkbenchStore<WorkbenchLayoutStoreState>({
    name: "workbench.layout",
    initialState: { layout: initialLayout, widgets: {}, placeholders: {} },
  });

  const getLayout = () => store.getState().layout;
  const getPlaceholders = () => store.getState().placeholders;
  const getWidgets = () => store.getState().widgets;
  const getPlaceholder = (areaId: WorkbenchArea) => getPlaceholders()[areaId];
  const areaQueries = createAreaQueries({ getLayout, getWidgets, getPlaceholder });
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

  const updateArea = (areaId: WorkbenchArea, update: (area: WorkbenchAreaState) => WorkbenchAreaState) => {
    const layout = getLayout();
    const area = layout.areas[areaId];
    const nextArea = update(area);
    if (nextArea === area) return;
    setLayout({ ...layout, areas: { ...layout.areas, [areaId]: nextArea } });
    persistLayout();
  };

  const applyAndActivate = (layout: WorkbenchLayout, areaId: WorkbenchArea, placement: WorkbenchWidgetPlacement) => {
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

    getAreaSize: areaQueries.getAreaSize,
    getAreaCollapsible: areaQueries.getAreaCollapsible,
    getAreaHeaderBorderBottom: areaQueries.getAreaHeaderBorderBottom,

    setAreaVisible(areaId, visible) {
      updateArea(areaId, (area) => (area.visible === visible ? area : { ...area, visible }));
    },

    setAreaSize(areaId, size) {
      updateArea(areaId, (area) => (area.size === size ? area : { ...area, size }));
    },

    listPlaceholders: contributionLists.listPlaceholders,
    listWidgets: contributionLists.listWidgets,
    openWidget: widgetOpeners.openWidget,

    updateWidgetPlacement(widgetId, update) {
      const layout = getLayout();
      for (const area of Object.values(layout.areas)) {
        const index = area.widgets.findIndex((placement) => placement.widgetId === widgetId);
        if (index < 0) continue;

        const widget = requireWidget(area.widgets[index].contributionId);
        const nextPlacement = buildUpdatedPlacement(area.widgets[index], widget, update);
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
      const area = layout.areas[areaId];
      const activeWidgetId = area.activeWidgetId;

      const cleared: WorkbenchLayout = {
        ...layout,
        areas: { ...layout.areas, [areaId]: { ...area, widgets: [], activeWidgetId: undefined } },
      };
      const next =
        activeWidgetId && layout.activeWidgetId === activeWidgetId
          ? { ...cleared, activeWidgetId: undefined, activeResourceUri: undefined }
          : cleared;

      setLayout(next);
      persistLayout();
    },

    resetAreas() {
      const layout = getLayout();
      const nextAreas = {} as WorkbenchLayout["areas"];
      for (const [id, area] of Object.entries(layout.areas) as [WorkbenchArea, WorkbenchAreaState][]) {
        nextAreas[id] = { ...area, widgets: [], activeWidgetId: undefined };
      }
      setLayout({ areas: nextAreas, activeWidgetId: undefined, activeResourceUri: undefined });
      persistLayout();
    },

    getLayout,

    restoreLayout(layout) {
      setLayout(mergeWithDefaultAreas(layout));
      persistLayout();
    },

    setPersistenceScope(nextScope) {
      if (currentScope === nextScope) return;
      input.persistence?.setLayout(getLayout(), currentScope);
      currentScope = nextScope;
      const incoming = input.persistence?.getLayout(currentScope);
      const nextLayout = incoming ? mergeWithDefaultAreas(incoming) : createDefaultWorkbenchLayout();
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
