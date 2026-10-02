import type { Localizable } from "../extension-kernel/l10n";
import type {
  DataTableRendererSettings,
  KanbanRendererViewSettings,
  ViewFilterGroup,
  ViewSort,
} from "../extension-kernel/types";
import { EMPTY_VIEW_FILTER } from "./collection-view";

export type KanbanViewSettings = Omit<KanbanRendererViewSettings, "ordering">;

export const DEFAULT_KANBAN_VIEW_SETTINGS: KanbanViewSettings = {
  viewMode: "board",
  columnGrouping: "none",
  rowGrouping: "none",
  displayProperties: [],
};

export const DEFAULT_DATA_TABLE_SETTINGS: DataTableRendererSettings = {
  grouping: "none",
  rowNumbers: true,
  wrapRows: false,
  showStats: true,
  hiddenColumns: [],
  columnOrder: [],
};

interface DeclaredView<TSettings> {
  id: string;
  title: Localizable<string>;
  settings?: Partial<TSettings>;
  filter?: ViewFilterGroup;
  sorts?: ViewSort[];
  isDefault?: boolean;
}

interface DeclaredViews<TSettings> {
  defaultSettings?: Partial<TSettings>;
  defaultFilter?: ViewFilterGroup;
  defaultSorts?: ViewSort[];
  defaultViews?: DeclaredView<TSettings>[];
}

const builtInViews = <TSettings>(base: TSettings, record: DeclaredViews<TSettings>) => {
  const settings: TSettings = { ...base, ...record.defaultSettings };
  if (!record.defaultViews?.length)
    return {
      settings,
      views: [
        {
          id: "default",
          title: "All" as Localizable<string>,
          settings,
          filter: record.defaultFilter ?? EMPTY_VIEW_FILTER,
          sorts: record.defaultSorts ?? [],
          builtIn: true,
        },
      ],
    };
  return {
    settings,
    views: record.defaultViews.map((view) => ({
      ...view,
      settings: { ...settings, ...view.settings } as TSettings,
      filter: view.filter ?? EMPTY_VIEW_FILTER,
      sorts: view.sorts ?? [],
      builtIn: true,
    })),
  };
};

/** The views a board offers before anyone saves one. Titles are returned unlocalized. */
export const kanbanBuiltInViews = (
  record: DeclaredViews<KanbanViewSettings> & { attributes?: { id: string; type: { kind: string } }[] },
) => {
  const statuses = record.attributes?.filter((field) => field.type.kind === "status") ?? [];
  // A board with one status field is a status board unless it says otherwise.
  const base =
    statuses.length === 1
      ? { ...DEFAULT_KANBAN_VIEW_SETTINGS, columnGrouping: statuses[0]!.id }
      : DEFAULT_KANBAN_VIEW_SETTINGS;
  return builtInViews(base, record);
};

/** The views a data table offers before anyone saves one. Titles are returned unlocalized. */
export const dataTableBuiltInViews = (record: DeclaredViews<DataTableRendererSettings>) =>
  builtInViews(DEFAULT_DATA_TABLE_SETTINGS, record);
