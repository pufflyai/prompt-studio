import type {
  BoardColumnConfig,
  DataRendererFilterCategory,
  DataRendererFilterState,
  DataRendererOption,
  DataRendererRow,
  DataRendererSettings,
  DataRendererTagDefinition,
  DisplayProperty,
  GroupingField,
  OrderingField,
} from "@pstdio/ui";
import type { ContributionMetadata, RegisteredContributionMetadata } from "../../shared/contributions/metadata";
import { byContributionPriority, normalizeContributionMetadata } from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { WorkbenchRendererRegistry, WorkbenchWidgetRenderInput } from "./renderer-registry";

export interface DataRendererQueryState {
  settings: DataRendererSettings;
  filters: DataRendererFilterState;
}

export interface DataRendererSavedViewsConfig {
  resourceKind: string;
  scope: "project" | "user";
  projectId?: string;
}

export interface DataRendererContribution<TRow extends DataRendererRow = DataRendererRow> {
  id: string;
  title: string;
  resourceKind?: string;

  // Schema (passed through to <DataRenderer>)
  tagDefinitions?: DataRendererTagDefinition[];
  groupingOptions?: DataRendererOption<GroupingField>[];
  orderingOptions?: DataRendererOption<OrderingField>[];
  displayPropertyOptions?: DataRendererOption<DisplayProperty>[];
  filterCategories?: DataRendererFilterCategory[];
  knownColumnKeys?: string[];
  getBoardColumnConfig?: (groupKey: string) => BoardColumnConfig;

  // Defaults applied on first mount (before any saved-view resource override)
  defaultSettings?: Partial<DataRendererSettings>;
  defaultFilters?: DataRendererFilterState;

  // Data source. Receives the current display state so backends can paginate/filter/sort.
  // <DataRenderer> re-applies filter/sort/group locally, so the renderer can return
  // unfiltered rows in simple cases; backends benefit from pushing filter down.
  executeQuery(state: DataRendererQueryState): Promise<TRow[]> | TRow[];

  // Row mutations bubbled to the contributor (mirrors <DataRenderer> callbacks)
  onTicketClick?: (row: TRow) => void;
  onTagChange?: (rowId: string, tagName: string, newValue: string) => void;
  onMoveTicket?: (
    rowId: string,
    targetColumnId: string,
    context?: { columnGrouping: GroupingField; beforeTicketId?: string },
  ) => void;
  onMoveToGroup?: (
    rowId: string,
    targetGroupKey: string,
    context?: { rowGrouping: GroupingField; beforeTicketId?: string },
  ) => void;
  onCreateTicket?: (columnId: string) => void;
  onColumnAction?: (columnId: string, actionId: string) => Promise<void> | void;

  // Optional saved-view persistence wiring. If set, WorkbenchDataView shows the
  // SavedViewMenu in the header bar and wires its callbacks to
  // workbench.savedViews. Omit for transient/analytics surfaces with no persisted
  // views.
  savedViews?: DataRendererSavedViewsConfig;
}

export interface RegisteredDataRendererContribution<TRow extends DataRendererRow = DataRendererRow>
  extends DataRendererContribution<TRow>,
    RegisteredContributionMetadata {}

export interface DataRendererStoreState {
  renderers: Record<string, RegisteredDataRendererContribution>;
}

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
}

export const createDataRendererRegistry = (input: CreateDataRendererRegistryInput): DataRendererRegistry => {
  const { rendererRegistry } = input;

  const dataStore = createWorkbenchStore<DataRendererStoreState>({
    name: "workbench.dataRenderers",
    initialState: { renderers: {} },
  });

  let implementation: DataRendererImplementation = () => null;

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

    listDataRenderers() {
      return Object.values(dataStore.getState().renderers).sort(byContributionPriority);
    },
  };
};
