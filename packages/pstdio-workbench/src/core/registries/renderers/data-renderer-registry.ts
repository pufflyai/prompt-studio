import type { ContributionMetadata, RegisteredContributionMetadata } from "../../shared/contributions/metadata";
import { byContributionPriority, normalizeContributionMetadata } from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type {
  AttributeDescriptor,
  AttributesSource,
  BoardColumnConfig,
  DataRendererFilterState,
  DataRendererRow,
  DataRendererSettings,
  ResourceContextAction,
} from "./data-renderer-contracts";
import type { WorkbenchRendererRegistry, WorkbenchWidgetRenderInput } from "./renderer-registry";

export interface DataRendererQueryState {
  settings: DataRendererSettings;
  filters: DataRendererFilterState;
}

export interface DataRendererContribution<TRow extends DataRendererRow = DataRendererRow> {
  id: string;
  title: string;
  resourceKind?: string;

  /**
   * Declarative attribute schema. The renderer dispatches filter / group /
   * sort / display / inline-edit behavior on each descriptor's `type.kind`.
   *
   * Pass an `AttributesSource` ({ subscribe, getSnapshot }) instead of a
   * static array to let the contribution mutate its schema at runtime —
   * `WorkbenchDataView` subscribes so additions / removals / kind changes
   * propagate live without re-registering the renderer.
   */
  attributes: AttributeDescriptor[] | AttributesSource;

  /** Per-board-column overrides (color, drag/create rules, custom actions). */
  getBoardColumnConfig?: (groupKey: string) => BoardColumnConfig;
  hideToolbar?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;

  /** Initial settings/filters applied when the data renderer mounts. */
  defaultSettings?: Partial<DataRendererSettings>;
  defaultFilters?: DataRendererFilterState;

  /**
   * Data source. Receives the current display state so backends can paginate
   * / filter / sort. The renderer re-applies filter / sort / group locally,
   * so this can return unfiltered rows in simple cases.
   */
  executeQuery(state: DataRendererQueryState): Promise<TRow[]> | TRow[];
  subscribe?: (listener: () => void) => Disposable | (() => void);

  /** Row interactions surfaced by the renderer (mirrored from <DataRenderer>). */
  onRowClick?: (row: TRow) => void;
  /** Per-row right-click context menu actions (mirrored from <DataRenderer>). */
  getRowContextMenuActions?: (row: TRow) => ResourceContextAction[];
  /**
   * Fires for inline attribute edits AND for cross-column drag-to-reorder on
   * the board (the renderer passes the grouping attribute id + the target
   * column value).
   */
  onAttributeChange?: (rowId: string, attributeId: string, value: unknown) => void;
  /** Manual within-column reorder (only fires when ordering is manual). */
  onReorder?: (rowId: string, beforeRowId?: string) => void;
  onCreateRow?: (columnId: string) => void;
  onColumnAction?: (columnId: string, actionId: string) => Promise<void> | void;
}

export interface RegisteredDataRendererContribution<TRow extends DataRendererRow = DataRendererRow>
  extends DataRendererContribution<TRow>,
    RegisteredContributionMetadata {}

export interface DataRendererStoreState {
  renderers: Record<string, RegisteredDataRendererContribution>;
}

export interface DataRendererRefreshEvent {
  dataRendererId: string;
}

export type DataRendererRefreshListener = (event: DataRendererRefreshEvent) => void;

// The React layer supplies the rendering for a data-renderer widget. Set once on
// workbench mount via setDataRendererImplementation so registerDataRenderer can
// auto-register a widget renderer with the same id.
export type DataRendererImplementation = (input: WorkbenchWidgetRenderInput & { dataRendererId: string }) => unknown;

export interface CreateDataRendererRegistryInput {
  rendererRegistry: WorkbenchRendererRegistry;
}

export interface DataRendererRegistry {
  dataStore: WorkbenchStore<DataRendererStoreState>;
  registerDataRenderer<TRow extends DataRendererRow = DataRendererRow>(
    contribution: DataRendererContribution<TRow>,
    metadata?: ContributionMetadata,
  ): Disposable;
  setDataRendererImplementation(impl: DataRendererImplementation): void;
  getDataRenderer(id: string): RegisteredDataRendererContribution | undefined;
  listDataRenderers(): RegisteredDataRendererContribution[];
  refreshDataRenderer(id: string): void;
  onDidRefreshDataRenderer(listener: DataRendererRefreshListener): Disposable;
}

export const createDataRendererRegistry = (input: CreateDataRendererRegistryInput): DataRendererRegistry => {
  const { rendererRegistry } = input;

  const dataStore = createWorkbenchStore<DataRendererStoreState>({
    name: "workbench.dataRenderers",
    initialState: { renderers: {} },
  });

  const refreshListeners = new Set<DataRendererRefreshListener>();
  let implementation: DataRendererImplementation = () => null;

  const requireDataRenderer = (id: string) => {
    const renderer = dataStore.getState().renderers[id];
    if (!renderer) throw new Error(`Data renderer not registered: ${id}`);
    return renderer;
  };

  return {
    dataStore,

    setDataRendererImplementation(impl) {
      implementation = impl;
    },

    registerDataRenderer(contribution, metadata) {
      const snapshot = dataStore.getState();
      if (snapshot.renderers[contribution.id]) throw new Error(`Data renderer already registered: ${contribution.id}`);

      const record = {
        ...normalizeContributionMetadata(metadata),
        ...contribution,
      } as RegisteredDataRendererContribution;

      dataStore.setState(
        { ...snapshot, renderers: { ...snapshot.renderers, [contribution.id]: record } },
        false,
        "registerDataRenderer",
      );

      // Auto-register a widget renderer with the same id; the React-side
      // implementation looks up the contribution by id and renders the
      // WorkbenchDataView component.
      const rendererDisposable = rendererRegistry.registerRenderer({
        id: contribution.id,
        render: (rendererInput) => implementation({ ...rendererInput, dataRendererId: contribution.id }),
      });

      return createDisposable(() => {
        rendererDisposable.dispose();
        const current = dataStore.getState();
        if (current.renderers[contribution.id] !== record) return;
        const { [contribution.id]: _removed, ...nextRenderers } = current.renderers;
        dataStore.setState({ renderers: nextRenderers }, false, "unregisterDataRenderer");
      });
    },

    getDataRenderer(id) {
      return dataStore.getState().renderers[id];
    },

    listDataRenderers(): RegisteredDataRendererContribution[] {
      return Object.values(dataStore.getState().renderers).sort(byContributionPriority);
    },

    refreshDataRenderer(id) {
      requireDataRenderer(id);
      const event = { dataRendererId: id };
      for (const listener of refreshListeners) listener(event);
    },

    onDidRefreshDataRenderer(listener) {
      refreshListeners.add(listener);
      return createDisposable(() => {
        refreshListeners.delete(listener);
      });
    },
  };
};
