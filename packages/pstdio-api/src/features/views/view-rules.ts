import {
  type BoardField,
  dataTableRendererSettingsSchema,
  findViewFilterProblem,
  findViewSortsProblem,
  type KanbanViewSettings,
  kanbanViewSettingsSchema,
} from "pstdio-api-contracts";
import { normalizeSubGroupings } from "pstdio-api-contracts/collections";
import type { ViewFilterGroup, ViewSort } from "pstdio-api-contracts/extension-kernel";

export type BoardKind = "kanban" | "resourceList" | "dataTable";
export interface ViewDraft {
  settings: object;
  filter: ViewFilterGroup;
  sorts: ViewSort[];
}
export class BoardViewError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 503 = 400,
  ) {
    super(message);
  }
}
export const idsFor = (fields: BoardField[], flag: "groupable" | "displayable") =>
  fields.filter((field) => field[flag]).map((field) => field.id);
const checkIds = (ids: string[], valid: string[], label: string) => {
  const invalid = ids.find((id) => !valid.includes(id));
  if (invalid !== undefined) throw new BoardViewError(`Invalid ${label} "${invalid}". Valid IDs: ${valid.join(", ")}`);
};
const settingsProblem = (keys: string[], kind: string) =>
  new BoardViewError(`These settings do not fit a ${kind} view. Valid settings: ${keys.join(", ")}`);
const validateKanbanSettings = (input: object, fields: BoardField[]) => {
  const parsed = kanbanViewSettingsSchema.strict().safeParse(input);
  if (!parsed.success) throw settingsProblem(Object.keys(kanbanViewSettingsSchema.shape), "board");
  const settings = parsed.data;
  const groupable = ["none", ...idsFor(fields, "groupable")];
  checkIds([settings.columnGrouping, settings.rowGrouping], groupable, "groupable field");
  checkIds(settings.displayProperties, idsFor(fields, "displayable"), "displayable field");
  return settings;
};
/** Normalizes a resource list's levels the way the list shows them, so a grouping change never fails. */
const resolveResourceListSettings = (settings: KanbanViewSettings, fields: BoardField[]) => {
  if (settings.viewMode !== "list" || settings.rowGrouping !== "none")
    throw new BoardViewError("Resource lists require list display; use subGroupings for more grouping levels.");
  checkIds(settings.subGroupings ?? [], idsFor(fields, "groupable"), "groupable field");
  if (!settings.subGroupings) return settings;
  return { ...settings, subGroupings: normalizeSubGroupings(settings.columnGrouping, settings.subGroupings) };
};
const validateDataTableSettings = (input: object, fields: BoardField[]) => {
  const parsed = dataTableRendererSettingsSchema.strict().safeParse(input);
  if (!parsed.success) throw settingsProblem(Object.keys(dataTableRendererSettingsSchema.shape), "data table");
  const settings = parsed.data;
  checkIds([settings.grouping], ["none", ...idsFor(fields, "groupable")], "groupable field");
  checkIds(
    [...settings.hiddenColumns, ...settings.columnOrder],
    fields.map((field) => field.id),
    "column",
  );
  return settings;
};
/**
 * Checks the settings of a view, and the filter and sorts a request sends. Rules a view already
 * stores are not checked again: cleanup keeps rules that stopped fitting their field, and an
 * unrelated edit such as a rename must not fail because of them.
 */
export const validateBoardView = (
  kind: BoardKind,
  view: ViewDraft,
  fields: BoardField[],
  sent: { filter?: unknown; sorts?: unknown },
) => {
  const validated =
    kind !== "dataTable"
      ? validateKanbanSettings(view.settings, fields)
      : validateDataTableSettings(view.settings, fields);
  if (kind === "kanban" && "subGroupings" in validated && validated.subGroupings)
    throw new BoardViewError("subGroupings apply to resource lists only; boards use rowGrouping.");
  const settings =
    kind === "resourceList" && "viewMode" in validated ? resolveResourceListSettings(validated, fields) : validated;
  const problem =
    (sent.filter === undefined ? undefined : findViewFilterProblem(view.filter, fields)) ??
    (sent.sorts === undefined ? undefined : findViewSortsProblem(view.sorts, fields));
  if (problem) throw new BoardViewError(problem);
  return { settings, filter: view.filter, sorts: view.sorts.slice(0, 1) };
};
