import type { ContributionMetadata, RegisteredContributionMetadata } from "../../shared/contributions/metadata";
import { byContributionPriority, normalizeContributionMetadata } from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { ResourceRef } from "../resources/resource-registry";
import type { WorkbenchPanelRenderInput, WorkbenchRendererRegistry } from "./renderer-registry";

export interface DataTableRendererThemeColor {
  light: string;
  dark: string;
  foreground?: { light: string; dark: string };
}

export type DataTableRendererColumnStat =
  | { type: "unique" }
  | { type: "histogram"; bins?: number }
  | { type: "top-values"; limit?: number };

export type DataTableRendererColumnRenderer =
  | { type: "json" }
  | { type: "color-scale"; stops: Array<{ value: number; color: DataTableRendererThemeColor }> }
  | {
      type: "categorical-color";
      categories: Array<{ value: string | number | boolean | null; color: DataTableRendererThemeColor }>;
    };

export interface DataTableRendererColumn {
  id: string;
  label?: string;
  description?: string;
  icon?: unknown;
  hidden?: boolean;
  stat?: DataTableRendererColumnStat;
  renderer?: DataTableRendererColumnRenderer;
}

export interface DataTableRendererRow {
  id: string;
  values: Record<string, unknown>;
  resource?: ResourceRef;
}

export interface DataTableRendererQueryResult {
  rows: DataTableRendererRow[];
  columns?: DataTableRendererColumn[];
}

export interface DataTableRendererQueryContext {
  resource?: ResourceRef;
  modeId?: string;
}

export interface DataTableRendererRowAction {
  id: string;
  label: string;
  icon?: unknown;
  destructive?: boolean;
  run(row: DataTableRendererRow): Promise<void> | void;
}

export interface DataTableRendererSelectionAction {
  id: string;
  label: string;
  icon?: unknown;
  destructive?: boolean;
  run(rows: DataTableRendererRow[]): Promise<void> | void;
}

export interface DataTableRendererContribution {
  id: string;
  title: string;
  resourceKind?: string;
  columns?: DataTableRendererColumn[];
  selectionMode?: "none" | "multiple";
  selectionActions?: DataTableRendererSelectionAction[];
  rowActions?: DataTableRendererRowAction[];
  initialPageSize?: number;
  pageSizeOptions?: number[];
  emptyTitle?: string;
  emptyDescription?: string;
  executeQuery(
    context: DataTableRendererQueryContext,
  ): Promise<DataTableRendererQueryResult> | DataTableRendererQueryResult;
  subscribe?: (listener: () => void) => Disposable | (() => void);
  onRowActivate?: (row: DataTableRendererRow) => Promise<void> | void;
}

export interface RegisteredDataTableRendererContribution
  extends DataTableRendererContribution,
    RegisteredContributionMetadata {}

export interface DataTableRendererStoreState {
  renderers: Record<string, RegisteredDataTableRendererContribution>;
}

export interface DataTableRendererRefreshEvent {
  dataTableRendererId: string;
}

export type DataTableRendererImplementation = (
  input: WorkbenchPanelRenderInput & { dataTableRendererId: string },
) => unknown;

export interface DataTableRendererRegistry {
  dataTableStore: WorkbenchStore<DataTableRendererStoreState>;
  registerDataTableRenderer(contribution: DataTableRendererContribution, metadata?: ContributionMetadata): Disposable;
  setDataTableRendererImplementation(implementation: DataTableRendererImplementation): void;
  getDataTableRenderer(id: string): RegisteredDataTableRendererContribution | undefined;
  listDataTableRenderers(): RegisteredDataTableRendererContribution[];
  refreshDataTableRenderer(id: string): void;
  onDidRefreshDataTableRenderer(listener: (event: DataTableRendererRefreshEvent) => void): Disposable;
}

export const createDataTableRendererRegistry = (input: {
  rendererRegistry: WorkbenchRendererRegistry;
}): DataTableRendererRegistry => {
  const dataTableStore = createWorkbenchStore<DataTableRendererStoreState>({
    name: "workbench.dataTableRenderers",
    initialState: { renderers: {} },
  });
  const refreshListeners = new Set<(event: DataTableRendererRefreshEvent) => void>();
  let implementation: DataTableRendererImplementation = () => null;

  return {
    dataTableStore,
    setDataTableRendererImplementation(next) {
      implementation = next;
    },
    registerDataTableRenderer(contribution, metadata) {
      const snapshot = dataTableStore.getState();
      if (snapshot.renderers[contribution.id]) {
        throw new Error(`Data table renderer already registered: ${contribution.id}`);
      }
      const record = {
        ...normalizeContributionMetadata(metadata),
        ...contribution,
      } as RegisteredDataTableRendererContribution;
      dataTableStore.setState(
        { renderers: { ...snapshot.renderers, [contribution.id]: record } },
        false,
        "registerDataTableRenderer",
      );
      const rendererDisposable = input.rendererRegistry.registerRenderer({
        id: contribution.id,
        render: (rendererInput) => implementation({ ...rendererInput, dataTableRendererId: contribution.id }),
      });
      return createDisposable(() => {
        rendererDisposable.dispose();
        const current = dataTableStore.getState();
        if (current.renderers[contribution.id] !== record) return;
        const { [contribution.id]: _removed, ...renderers } = current.renderers;
        dataTableStore.setState({ renderers }, false, "unregisterDataTableRenderer");
      });
    },
    getDataTableRenderer(id) {
      return dataTableStore.getState().renderers[id];
    },
    listDataTableRenderers() {
      return Object.values(dataTableStore.getState().renderers).sort(byContributionPriority);
    },
    refreshDataTableRenderer(id) {
      if (!dataTableStore.getState().renderers[id]) throw new Error(`Data table renderer not registered: ${id}`);
      const event = { dataTableRendererId: id };
      for (const listener of refreshListeners) listener(event);
    },
    onDidRefreshDataTableRenderer(listener) {
      refreshListeners.add(listener);
      return createDisposable(() => refreshListeners.delete(listener));
    },
  } satisfies DataTableRendererRegistry;
};
