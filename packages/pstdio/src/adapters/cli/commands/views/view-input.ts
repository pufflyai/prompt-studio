import type { BoardSummary, BoardViewUpdate } from "@pstdio/sdk/api";
import type { DataTableRendererSettings, KanbanRendererSettings, ViewSort } from "@pstdio/sdk/extensions";
import { buildFilter } from "./view-filter-input";

export interface ViewFlags {
  title?: string;
  filter?: string[];
  "filter-json"?: string;
  sort?: string[];
  show?: string;
  mode?: string;
  columns?: string;
  rows?: string;
  group?: string;
  "row-numbers"?: string;
  "wrap-rows"?: string;
  stats?: string;
}
type Board = Pick<BoardSummary, "kind" | "fields">;
const kindFlags = {
  kanban: ["mode", "columns", "rows"],
  dataTable: ["group", "row-numbers", "wrap-rows", "stats"],
} as const;
const kindNames = { kanban: "board", dataTable: "data table" };
const refuseOtherKindFlags = (flags: ViewFlags, kind: Board["kind"]) => {
  const other = kind === "kanban" ? "dataTable" : "kanban";
  const flag = kindFlags[other].find((flag) => flags[flag] !== undefined);
  if (flag)
    throw new Error(
      `--${flag} applies to ${kindNames[other]} views only. A ${kindNames[kind]} view takes ${[...kindFlags[kind], "show"].map((name) => `--${name}`).join(", ")}`,
    );
};
const toggle = (value: string, on: string, off: string, flag: string) => {
  if (value !== on && value !== off) throw new Error(`--${flag} must be ${on} or ${off}`);
  return value === on;
};
const buildBoardSettings = (flags: ViewFlags) => {
  const settings: Partial<Omit<KanbanRendererSettings, "ordering">> = {};
  if (flags.mode !== undefined) {
    if (flags.mode !== "board" && flags.mode !== "list") throw new Error("Mode must be board or list");
    settings.viewMode = flags.mode;
  }
  if (flags.columns !== undefined) settings.columnGrouping = flags.columns;
  if (flags.rows !== undefined) settings.rowGrouping = flags.rows;
  if (flags.show !== undefined) settings.displayProperties = flags.show.split(",").filter(Boolean);
  return settings;
};
const buildTableSettings = (flags: ViewFlags, board: Board) => {
  const settings: Partial<DataTableRendererSettings> = {};
  if (flags.group !== undefined) settings.grouping = flags.group;
  if (flags["row-numbers"] !== undefined)
    settings.rowNumbers = toggle(flags["row-numbers"], "show", "hide", "row-numbers");
  if (flags["wrap-rows"] !== undefined) settings.wrapRows = toggle(flags["wrap-rows"], "on", "off", "wrap-rows");
  if (flags.stats !== undefined) settings.showStats = toggle(flags.stats, "on", "off", "stats");
  if (flags.show !== undefined) {
    // --show lists the visible columns in order; every other column is hidden and keeps its place after them.
    const shown = flags.show.split(",").filter(Boolean);
    const others = board.fields.map((field) => field.id).filter((id) => !shown.includes(id));
    settings.columnOrder = [...shown, ...others];
    settings.hiddenColumns = others;
  }
  return settings;
};
const buildSorts = (values: string[]) => {
  if (values.length > 1) throw new Error("A view allows only one sort");
  if (values.length === 1 && values[0] === "none") return [];
  return values.map((value): ViewSort => {
    const [attributeId, direction, extra] = value.split(":");
    if (!attributeId || extra !== undefined || (direction !== "asc" && direction !== "desc"))
      throw new Error("Sort must be <field>:asc|desc");
    return { attributeId, direction };
  });
};
export const buildViewInput = (flags: ViewFlags, board: Board) => {
  refuseOtherKindFlags(flags, board.kind);
  const input: BoardViewUpdate = {};
  if (flags.title !== undefined) input.title = flags.title;
  const settings = board.kind === "kanban" ? buildBoardSettings(flags) : buildTableSettings(flags, board);
  if (Object.keys(settings).length) input.settings = settings;
  const filter = buildFilter(flags, board.fields);
  if (filter) input.filter = filter;
  if (flags.sort) input.sorts = buildSorts(flags.sort);
  return input;
};
