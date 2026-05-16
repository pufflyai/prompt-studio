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
  findPlacement,
  getActivePlacement,
  removePlacementsForContribution,
  replaceAreaWidgets,
} from "./layout-operations";
import {
  type AreaPlaceholderContribution,
  createDefaultWorkbenchLayout,
  mergeWithDefaultAreas,
  type OpenWidgetInput,
  type RegisteredAreaPlaceholderContribution,
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
  AreaPlaceholderContribution,
  OpenWidgetInput,
  RegisteredAreaPlaceholderContribution,
  RegisteredWidgetContribution,
  WidgetContribution,
  WorkbenchArea,
  WorkbenchAreaSize,
  WorkbenchAreaState,
  WorkbenchLayout,
  WorkbenchLayoutStoreState,
  WorkbenchWidgetPlacement,
} from "./layout-types";
export { createDefaultWorkbenchLayout, workbenchAreas } from "./layout-types";

export interface LayoutPersistenceAdapter {
  getLayout(): WorkbenchLayout | undefined;
  setLayout(layout: WorkbenchLayout): void;
}

export interface CreateLayoutModelInput {
  persistence?: LayoutPersistenceAdapter;
}

export interface LayoutModel {
  store: WorkbenchStore<WorkbenchLayoutStoreState>;
  registerAreaPlaceholder(
    placeholder: AreaPlaceholderContribution,
    metadata?: ContributionMetadata,
  ): { dispose(): void };
  registerWidget(widget: WidgetContribution, metadata?: ContributionMetadata): { dispose(): void };
  getAreaPlaceholder(areaId: WorkbenchArea): RegisteredAreaPlaceholderContribution | undefined;
  getWidget(id: string): RegisteredWidgetContribution | undefined;
  getAreaSize(areaId: WorkbenchArea): WorkbenchAreaSize | undefined;
  getAreaCollapsible(areaId: WorkbenchArea): boolean;
  getAreaHeaderBorderBottom(areaId: WorkbenchArea): boolean;
  setAreaVisible(areaId: WorkbenchArea, visible: boolean): void;
  setAreaSize(areaId: WorkbenchArea, size: number): void;
  listAreaPlaceholders(): RegisteredAreaPlaceholderContribution[];
  listWidgets(): RegisteredWidgetContribution[];
  openWidget(id: string, input?: OpenWidgetInput): WorkbenchWidgetPlacement;
  activateWidget(widgetId: string): WorkbenchWidgetPlacement;
  closeWidget(widgetId: string): WorkbenchWidgetPlacement | undefined;
  removeWidgetPlacement(widgetId: string): WorkbenchWidgetPlacement | undefined;
  clearArea(areaId: WorkbenchArea): void;
  resetAreas(): void;
  getLayout(): WorkbenchLayout;
}

interface CreateAreaQueriesInput {
  getLayout(): WorkbenchLayout;
  getWidgets(): WorkbenchLayoutStoreState["widgets"];
  getAreaPlaceholder(areaId: WorkbenchArea): RegisteredAreaPlaceholderContribution | undefined;
}

interface CreateContributionListsInput {
  getAreaPlaceholders(): WorkbenchLayoutStoreState["areaPlaceholders"];
  getWidgets(): WorkbenchLayoutStoreState["widgets"];
}

interface CreateContributionRegistrationsInput {
  store: InternalWorkbenchStore<WorkbenchLayoutStoreState>;
  getAreaPlaceholders(): WorkbenchLayoutStoreState["areaPlaceholders"];
  getWidgets(): WorkbenchLayoutStoreState["widgets"];
  persistLayout(): void;
}

const createAreaQueries = (input: CreateAreaQueriesInput) => {
  const { getLayout, getWidgets, getAreaPlaceholder } = input;

  return {
    getAreaSize(areaId: WorkbenchArea) {
      const persistedSize = getLayout().areas[areaId].size;
      const placement = getActivePlacement(getLayout().areas[areaId]);
      const contributionSize = placement
        ? getWidgets()[placement.contributionId]?.areaSize
        : getAreaPlaceholder(areaId)?.areaSize;
      if (persistedSize === undefined) return contributionSize;
      return { ...contributionSize, defaultPx: persistedSize };
    },

    getAreaCollapsible(areaId: WorkbenchArea) {
      const placement = getActivePlacement(getLayout().areas[areaId]);
      if (!placement) return getAreaPlaceholder(areaId)?.areaCollapsible ?? true;
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
  const { getAreaPlaceholders, getWidgets } = input;

  return {
    listAreaPlaceholders() {
      return Object.values(getAreaPlaceholders()).sort(byContributionPriority);
    },

    listWidgets() {
      return Object.values(getWidgets()).sort(byContributionPriority);
    },
  };
};

const createContributionRegistrations = (input: CreateContributionRegistrationsInput) => {
  const { store, getAreaPlaceholders, getWidgets, persistLayout } = input;

  return {
    registerAreaPlaceholder(placeholder: AreaPlaceholderContribution, metadata?: ContributionMetadata) {
      const placeholdersBefore = getAreaPlaceholders();
      if (placeholdersBefore[placeholder.area]) {
        throw new Error(`Area placeholder already registered: ${placeholder.area}`);
      }

      const { priority, ...placeholderContribution } = placeholder;
      const record: RegisteredAreaPlaceholderContribution = {
        ...placeholderContribution,
        ...normalizeContributionMetadata({ ...metadata, priority: metadata?.priority ?? priority }),
      };

      const snapshot = store.getState();
      store.setState(
        { ...snapshot, areaPlaceholders: { ...snapshot.areaPlaceholders, [placeholder.area]: record } },
        false,
        "registerAreaPlaceholder",
      );

      return createDisposable(() => {
        const current = store.getState();
        if (current.areaPlaceholders[placeholder.area] !== record) return;

        const { [placeholder.area]: _removed, ...nextPlaceholders } = current.areaPlaceholders;
        store.setState({ ...current, areaPlaceholders: nextPlaceholders }, false, "unregisterAreaPlaceholder");
      });
    },

    registerWidget(widget: WidgetContribution, metadata?: ContributionMetadata) {
      const widgetsBefore = getWidgets();
      if (widgetsBefore[widget.id]) throw new Error(`Widget already registered: ${widget.id}`);

      const { priority, ...widgetContribution } = widget;
      const record: RegisteredWidgetContribution = {
        ...widgetContribution,
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

export const createLayoutModel = (input: CreateLayoutModelInput = {}): LayoutModel => {
  const persisted = input.persistence?.getLayout();
  const initialLayout = persisted ? mergeWithDefaultAreas(persisted) : createDefaultWorkbenchLayout();

  const store = createWorkbenchStore<WorkbenchLayoutStoreState>({
    name: "workbench.layout",
    initialState: { layout: initialLayout, widgets: {}, areaPlaceholders: {} },
  });

  let placementCounter = 0;

  const getLayout = () => store.getState().layout;
  const getAreaPlaceholders = () => store.getState().areaPlaceholders;
  const getWidgets = () => store.getState().widgets;
  const getAreaPlaceholder = (areaId: WorkbenchArea) => getAreaPlaceholders()[areaId];
  const areaQueries = createAreaQueries({ getLayout, getWidgets, getAreaPlaceholder });
  const contributionLists = createContributionLists({ getAreaPlaceholders, getWidgets });

  const persistLayout = () => {
    input.persistence?.setLayout(getLayout());
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

  const applyAndActivate = (
    layout: WorkbenchLayout,
    areaId: WorkbenchArea,
    placement: WorkbenchWidgetPlacement,
  ): WorkbenchWidgetPlacement => {
    setLayout(activateInLayout(layout, areaId, placement));
    persistLayout();
    return placement;
  };

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

  const insertWidget = (
    widget: RegisteredWidgetContribution,
    areaId: WorkbenchArea,
    replacementIndex: number,
    openInput: OpenWidgetInput,
  ): WorkbenchWidgetPlacement => {
    const area = getLayout().areas[areaId];
    const hasPlacement = area.widgets.some(
      (placement, index) => index !== replacementIndex && placement.widgetId === widget.id,
    );
    if (hasPlacement) placementCounter += 1;
    const widgetId = hasPlacement ? `${widget.id}:${placementCounter}` : widget.id;
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
    const existing = widget.singleton ? findPlacement(layout, widget.id) : undefined;
    if (existing) return updateSingleton(widget, existing, openInput);

    const areaId = openInput.area ?? widget.area ?? widget.fallbackArea ?? "main";
    const area = layout.areas[areaId];
    const replacementIndex = openInput.replaceActive
      ? area.widgets.findIndex((placement) => placement.widgetId === area.activeWidgetId && !placement.pinned)
      : -1;
    const replacement = replacementIndex >= 0 ? area.widgets[replacementIndex] : undefined;
    if (replacement?.contributionId === widget.id) {
      return replaceActive(widget, areaId, replacementIndex, replacement, openInput);
    }

    return insertWidget(widget, areaId, replacementIndex, openInput);
  };
  const contributionRegistrations = createContributionRegistrations({
    store,
    getAreaPlaceholders,
    getWidgets,
    persistLayout,
  });

  return {
    store,

    registerAreaPlaceholder: contributionRegistrations.registerAreaPlaceholder,

    registerWidget: contributionRegistrations.registerWidget,

    getWidget(id) {
      return getWidgets()[id];
    },

    getAreaPlaceholder,

    getAreaSize: areaQueries.getAreaSize,
    getAreaCollapsible: areaQueries.getAreaCollapsible,
    getAreaHeaderBorderBottom: areaQueries.getAreaHeaderBorderBottom,

    setAreaVisible(areaId, visible) {
      updateArea(areaId, (area) => (area.visible === visible ? area : { ...area, visible }));
    },

    setAreaSize(areaId, size) {
      updateArea(areaId, (area) => (area.size === size ? area : { ...area, size }));
    },

    listAreaPlaceholders: contributionLists.listAreaPlaceholders,
    listWidgets: contributionLists.listWidgets,
    openWidget,

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
  };
};
