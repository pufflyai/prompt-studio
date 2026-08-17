import type { ContributionMetadata, RegisteredContributionMetadata } from "../../shared/contributions/metadata";
import { byContributionPriority, normalizeContributionMetadata } from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type {
  AttributeDescriptor,
  AttributesSource,
  BoardColumnConfig,
  KanbanRendererCreateRowConfig,
  KanbanRendererCreateSubmission,
  KanbanRendererFilterState,
  KanbanRendererRow,
  KanbanRendererSavedView,
  KanbanRendererSettings,
  ResourceContextAction,
} from "./kanban-renderer-contracts";
import type { WorkbenchPanelRenderInput, WorkbenchRendererRegistry } from "./renderer-registry";

export interface KanbanRendererQueryState {
  settings: KanbanRendererSettings;
  filters: KanbanRendererFilterState;
}

export interface KanbanRendererContribution<TRow extends KanbanRendererRow = KanbanRendererRow> {
  id: string;
  title: string;
  resourceKind?: string;

  /**
   * Declarative attribute schema. The renderer dispatches filter / group /
   * sort / display / inline-edit behavior on each descriptor's `type.kind`.
   *
   * Pass an `AttributesSource` ({ subscribe, getSnapshot }) instead of a
   * static array to let the contribution mutate its schema at runtime —
   * `WorkbenchKanbanView` subscribes so additions / removals / kind changes
   * propagate live without re-registering the renderer.
   */
  attributes: AttributeDescriptor[] | AttributesSource;

  /** Per-board-column overrides (color, drag/create rules, custom actions). */
  getBoardColumnConfig?: (groupKey: string) => BoardColumnConfig;
  hideToolbar?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;

  /** Initial settings/filters applied when the kanban renderer mounts. */
  defaultSettings?: Partial<KanbanRendererSettings>;
  defaultFilters?: KanbanRendererFilterState;
  defaultViews?: KanbanRendererSavedView[];
  defaultActiveViewId?: string;

  /**
   * Data source. Receives the current display state so backends can paginate
   * / filter / sort. The renderer re-applies filter / sort / group locally,
   * so this can return unfiltered rows in simple cases.
   */
  executeQuery(state: KanbanRendererQueryState): Promise<TRow[]> | TRow[];
  subscribe?: (listener: () => void) => Disposable | (() => void);

  /** Row activation surfaced by the renderer (mirrored from <KanbanRenderer>). */
  onRowActivate?: (row: TRow) => Promise<void> | void;
  /** Per-row right-click context menu actions (mirrored from <KanbanRenderer>). */
  getRowContextMenuActions?: (row: TRow) => ResourceContextAction[];
  /**
   * Fires for inline attribute edits AND for cross-column drag-to-reorder on
   * the board (the renderer passes the grouping attribute id + the target
   * column value).
   */
  onAttributeChange?: (rowId: string, attributeId: string, value: unknown) => Promise<void> | void;
  /** Manual within-column reorder (only fires when ordering is manual). */
  onReorder?: (rowId: string, beforeRowId?: string) => Promise<void> | void;
  createRow?: KanbanRendererCreateRowConfig;
  onCreateRow?: (submission: KanbanRendererCreateSubmission) => Promise<void> | void;
  onColumnAction?: (columnId: string, actionId: string) => Promise<void> | void;
}

export interface RegisteredKanbanRendererContribution<TRow extends KanbanRendererRow = KanbanRendererRow>
  extends KanbanRendererContribution<TRow>,
    RegisteredContributionMetadata {}

export interface KanbanRendererStoreState {
  renderers: Record<string, RegisteredKanbanRendererContribution>;
}

export interface KanbanRendererRefreshEvent {
  kanbanRendererId: string;
}

export type KanbanRendererRefreshListener = (event: KanbanRendererRefreshEvent) => void;

// The React layer supplies the rendering for a kanban-renderer Panel. Set once on
// workbench mount via setKanbanRendererImplementation so registerKanbanRenderer can
// auto-register a Panel renderer with the same id.
export type KanbanRendererImplementation = (input: WorkbenchPanelRenderInput & { kanbanRendererId: string }) => unknown;

export interface CreateKanbanRendererRegistryInput {
  rendererRegistry: WorkbenchRendererRegistry;
}

export interface KanbanRendererRegistry {
  dataStore: WorkbenchStore<KanbanRendererStoreState>;
  registerKanbanRenderer<TRow extends KanbanRendererRow = KanbanRendererRow>(
    contribution: KanbanRendererContribution<TRow>,
    metadata?: ContributionMetadata,
  ): Disposable;
  setKanbanRendererImplementation(impl: KanbanRendererImplementation): void;
  getKanbanRenderer(id: string): RegisteredKanbanRendererContribution | undefined;
  listKanbanRenderers(): RegisteredKanbanRendererContribution[];
  refreshKanbanRenderer(id: string): void;
  onDidRefreshKanbanRenderer(listener: KanbanRendererRefreshListener): Disposable;
}

export const createKanbanRendererRegistry = (input: CreateKanbanRendererRegistryInput): KanbanRendererRegistry => {
  const { rendererRegistry } = input;

  const dataStore = createWorkbenchStore<KanbanRendererStoreState>({
    name: "workbench.kanbanRenderers",
    initialState: { renderers: {} },
  });

  const refreshListeners = new Set<KanbanRendererRefreshListener>();
  let implementation: KanbanRendererImplementation = () => null;

  const requireKanbanRenderer = (id: string) => {
    const renderer = dataStore.getState().renderers[id];
    if (!renderer) throw new Error(`Kanban renderer not registered: ${id}`);
    return renderer;
  };

  return {
    dataStore,

    setKanbanRendererImplementation(impl) {
      implementation = impl;
    },

    registerKanbanRenderer(contribution, metadata) {
      const snapshot = dataStore.getState();
      if (snapshot.renderers[contribution.id])
        throw new Error(`Kanban renderer already registered: ${contribution.id}`);

      const record = {
        ...normalizeContributionMetadata(metadata),
        ...contribution,
      } as RegisteredKanbanRendererContribution;

      dataStore.setState(
        { ...snapshot, renderers: { ...snapshot.renderers, [contribution.id]: record } },
        false,
        "registerKanbanRenderer",
      );

      // Auto-register a Panel renderer with the same id; the React-side
      // implementation looks up the contribution by id and renders the
      // WorkbenchKanbanView component.
      const rendererDisposable = rendererRegistry.registerRenderer({
        id: contribution.id,
        render: (rendererInput) => implementation({ ...rendererInput, kanbanRendererId: contribution.id }),
      });

      return createDisposable(() => {
        rendererDisposable.dispose();
        const current = dataStore.getState();
        if (current.renderers[contribution.id] !== record) return;
        const { [contribution.id]: _removed, ...nextRenderers } = current.renderers;
        dataStore.setState({ renderers: nextRenderers }, false, "unregisterKanbanRenderer");
      });
    },

    getKanbanRenderer(id) {
      return dataStore.getState().renderers[id];
    },

    listKanbanRenderers(): RegisteredKanbanRendererContribution[] {
      return Object.values(dataStore.getState().renderers).sort(byContributionPriority);
    },

    refreshKanbanRenderer(id) {
      requireKanbanRenderer(id);
      const event = { kanbanRendererId: id };
      for (const listener of refreshListeners) listener(event);
    },

    onDidRefreshKanbanRenderer(listener) {
      refreshListeners.add(listener);
      return createDisposable(() => {
        refreshListeners.delete(listener);
      });
    },
  };
};
