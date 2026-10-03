import {
  type BoardField,
  type BoardViewSettings,
  type KanbanViewSettings,
  normalizeBooleanViewRule,
} from "pstdio-api-contracts";
import {
  type DataTableRendererSettings,
  VIEW_FILTER_CONDITIONS,
  type ViewFilterCondition,
  type ViewFilterGroup,
  type ViewFilterRule,
  type ViewSort,
} from "pstdio-api-contracts/extension-kernel";
import { idsFor } from "./view-rules";

type BoardDefaults =
  | { kind: "kanban"; settings: KanbanViewSettings }
  | { kind: "dataTable"; settings: DataTableRendererSettings };
interface SavedViewState {
  settings: BoardViewSettings;
  filter: ViewFilterGroup;
  sorts: ViewSort[];
}

// Single-value and multi-value option fields name the same idea differently, so a rule survives
// a field that changes between them. Saved views from before rules existed also rely on this.
const equivalentConditions: Partial<Record<ViewFilterCondition, ViewFilterCondition>> = {
  "is-any-of": "has-any-of",
  "has-any-of": "is-any-of",
  "is-none-of": "has-none-of",
  "has-none-of": "is-none-of",
};
/**
 * Removes what refers to fields or options that are gone. A rule whose condition no longer fits its
 * field is kept: the renderer skips it, and it works again if the field returns to its old kind.
 */
const cleanRule = (rule: ViewFilterRule, fields: BoardField[]) => {
  const field = fields.find((field) => field.id === rule.attributeId && field.filterable);
  if (!field) return [];
  rule = normalizeBooleanViewRule(rule, field);
  const accepted = VIEW_FILTER_CONDITIONS[field.kind];
  const fits = accepted.includes(rule.condition);
  const equivalent = equivalentConditions[rule.condition];
  const fitsEquivalent = !fits && equivalent !== undefined && accepted.includes(equivalent);
  const condition = fitsEquivalent && equivalent ? equivalent : rule.condition;
  const options = field.options;
  const values = Array.isArray(rule.value) ? rule.value : undefined;
  const kept = options ? values?.filter((value) => options.some((option) => option.value === value)) : undefined;
  if (values?.length && kept?.length === 0) return [];
  return [kept ? { ...rule, condition, value: kept } : { ...rule, condition }];
};
const cleanFilter = (filter: ViewFilterGroup, fields: BoardField[]): ViewFilterGroup => ({
  ...filter,
  rules: filter.rules.flatMap((rule) => cleanRule(rule, fields)),
});
const grouping = (value: string, fallback: string, fields: BoardField[]) => {
  const ids = ["none", ...idsFor(fields, "groupable")];
  if (ids.includes(value)) return value;
  return ids.includes(fallback) ? fallback : "none";
};
const cleanKanbanSettings = (settings: KanbanViewSettings, defaults: KanbanViewSettings, fields: BoardField[]) => ({
  ...settings,
  columnGrouping: grouping(settings.columnGrouping, defaults.columnGrouping, fields),
  rowGrouping: grouping(settings.rowGrouping, defaults.rowGrouping, fields),
  displayProperties: settings.displayProperties.filter((id) => idsFor(fields, "displayable").includes(id)),
});
const cleanDataTableSettings = (
  settings: DataTableRendererSettings,
  defaults: DataTableRendererSettings,
  fields: BoardField[],
) => {
  const known = (id: string) => fields.some((field) => field.id === id);
  return {
    ...settings,
    grouping: grouping(settings.grouping, defaults.grouping, fields),
    hiddenColumns: settings.hiddenColumns.filter(known),
    columnOrder: settings.columnOrder.filter(known),
  };
};
/** Drops the parts of a saved view that no longer fit its board's fields. */
export const cleanBoardView = (board: BoardDefaults, view: SavedViewState, fields: BoardField[]) => ({
  // A saved view always has its board's kind of settings, because the API refuses others on write.
  settings:
    board.kind === "kanban"
      ? cleanKanbanSettings(view.settings as KanbanViewSettings, board.settings, fields)
      : cleanDataTableSettings(view.settings as DataTableRendererSettings, board.settings, fields),
  filter: cleanFilter(view.filter, fields),
  sorts: view.sorts.filter((sort) => fields.some((field) => field.id === sort.attributeId)),
});
