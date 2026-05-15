import {
  byContributionPriority,
  type ContributionMetadata,
  normalizeContributionMetadata,
} from "../../shared/contributions/metadata";
import { createDisposable } from "../../shared/disposable";
import { createShellStore, type ShellStore } from "../../shared/store/shell-store";
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
  createDefaultShellLayout,
  mergeWithDefaultAreas,
  type OpenWidgetInput,
  type RegisteredAreaPlaceholderContribution,
  type RegisteredWidgetContribution,
  type ShellArea,
  type ShellAreaSize,
  type ShellLayout,
  type ShellLayoutStoreState,
  type ShellWidgetPlacement,
  type WidgetContribution,
} from "./layout-types";

export type {
  AreaPlaceholderContribution,
  OpenWidgetInput,
  RegisteredAreaPlaceholderContribution,
  RegisteredWidgetContribution,
  ShellArea,
  ShellAreaSize,
  ShellAreaState,
  ShellLayout,
  ShellLayoutStoreState,
  ShellWidgetPlacement,
  WidgetContribution,
} from "./layout-types";
export { createDefaultShellLayout, shellAreas } from "./layout-types";

export interface LayoutPersistenceAdapter {
  getLayout(): ShellLayout | undefined;
  setLayout(layout: ShellLayout): void;
}

export interface CreateLayoutModelInput {
  persistence?: LayoutPersistenceAdapter;
}

export interface LayoutModel {
  store: ShellStore<ShellLayoutStoreState>;
  registerAreaPlaceholder(
    placeholder: AreaPlaceholderContribution,
    metadata?: ContributionMetadata,
  ): { dispose(): void };
  registerWidget(widget: WidgetContribution, metadata?: ContributionMetadata): { dispose(): void };
  getAreaPlaceholder(areaId: ShellArea): RegisteredAreaPlaceholderContribution | undefined;
  getWidget(id: string): RegisteredWidgetContribution | undefined;
  getAreaSize(areaId: ShellArea): ShellAreaSize | undefined;
  getAreaCollapsible(areaId: ShellArea): boolean;
  getAreaHeaderBorderBottom(areaId: ShellArea): boolean;
  listAreaPlaceholders(): RegisteredAreaPlaceholderContribution[];
  listWidgets(): RegisteredWidgetContribution[];
  openWidget(id: string, input?: OpenWidgetInput): ShellWidgetPlacement;
  activateWidget(widgetId: string): ShellWidgetPlacement;
  closeWidget(widgetId: string): ShellWidgetPlacement | undefined;
  clearArea(areaId: ShellArea): void;
  getLayout(): ShellLayout;
}

export const createLayoutModel = (input: CreateLayoutModelInput = {}): LayoutModel => {
  const persisted = input.persistence?.getLayout();
  const initialLayout = persisted ? mergeWithDefaultAreas(persisted) : createDefaultShellLayout();

  const store = createShellStore<ShellLayoutStoreState>({
    name: "shell.layout",
    initialState: { layout: initialLayout, widgets: {}, areaPlaceholders: {} },
  });

  let placementCounter = 0;

  const getLayout = () => store.getState().layout;
  const getAreaPlaceholders = () => store.getState().areaPlaceholders;
  const getWidgets = () => store.getState().widgets;
  const getAreaPlaceholder = (areaId: ShellArea) => getAreaPlaceholders()[areaId];

  const persistLayout = () => {
    input.persistence?.setLayout(getLayout());
  };

  const requireWidget = (id: string) => {
    const widget = getWidgets()[id];
    if (!widget) throw new Error(`Widget not registered: ${id}`);
    return widget;
  };

  const setLayout = (layout: ShellLayout) => {
    const snapshot = store.getState();
    if (snapshot.layout === layout) return;
    store.setState({ ...snapshot, layout }, false, "setLayout");
  };

  const applyAndActivate = (
    layout: ShellLayout,
    areaId: ShellArea,
    placement: ShellWidgetPlacement,
  ): ShellWidgetPlacement => {
    setLayout(activateInLayout(layout, areaId, placement));
    persistLayout();
    return placement;
  };

  const updateSingleton = (
    widget: RegisteredWidgetContribution,
    existing: NonNullable<ReturnType<typeof findPlacement>>,
    openInput: OpenWidgetInput,
  ): ShellWidgetPlacement => {
    const nextPlacement = buildUpdatedPlacement(existing.placement, widget, openInput);
    const layout = replaceAreaWidgets(getLayout(), existing.areaId, (widgets) =>
      widgets.map((current, index) => (index === existing.index ? nextPlacement : current)),
    );
    return applyAndActivate(layout, existing.areaId, nextPlacement);
  };

  const replaceActive = (
    widget: RegisteredWidgetContribution,
    areaId: ShellArea,
    replacementIndex: number,
    replacement: ShellWidgetPlacement,
    openInput: OpenWidgetInput,
  ): ShellWidgetPlacement => {
    const nextPlacement = buildUpdatedPlacement(replacement, widget, openInput);
    const layout = replaceAreaWidgets(getLayout(), areaId, (widgets) =>
      widgets.map((current, index) => (index === replacementIndex ? nextPlacement : current)),
    );
    return applyAndActivate(layout, areaId, nextPlacement);
  };

  const insertWidget = (
    widget: RegisteredWidgetContribution,
    areaId: ShellArea,
    replacementIndex: number,
    openInput: OpenWidgetInput,
  ): ShellWidgetPlacement => {
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

  return {
    store,

    registerAreaPlaceholder(placeholder, metadata) {
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

    registerWidget(widget, metadata) {
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

    getWidget(id) {
      return getWidgets()[id];
    },

    getAreaPlaceholder,

    getAreaSize(areaId) {
      const placement = getActivePlacement(getLayout().areas[areaId]);
      if (!placement) return getAreaPlaceholder(areaId)?.areaSize;
      return getWidgets()[placement.contributionId]?.areaSize;
    },

    getAreaCollapsible(areaId) {
      const placement = getActivePlacement(getLayout().areas[areaId]);
      if (!placement) return getAreaPlaceholder(areaId)?.areaCollapsible ?? true;
      return getWidgets()[placement.contributionId]?.areaCollapsible ?? true;
    },

    getAreaHeaderBorderBottom(areaId) {
      const placement = getActivePlacement(getLayout().areas[areaId]);
      if (!placement) return true;
      return getWidgets()[placement.contributionId]?.headerBorderBottom ?? true;
    },

    listAreaPlaceholders() {
      return Object.values(getAreaPlaceholders()).sort(byContributionPriority);
    },

    listWidgets() {
      return Object.values(getWidgets()).sort(byContributionPriority);
    },

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

    clearArea(areaId) {
      const layout = getLayout();
      const area = layout.areas[areaId];
      const activeWidgetId = area.activeWidgetId;

      const cleared: ShellLayout = {
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

    getLayout,
  };
};
