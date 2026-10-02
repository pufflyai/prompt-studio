import {
  type BoardField,
  dataTableRendererSettingsSchema,
  findViewFilterProblem,
  findViewSortsProblem,
  kanbanViewSettingsSchema,
} from "pstdio-api-contracts";
import type { ViewFilterGroup, ViewSort } from "pstdio-api-contracts/extension-kernel";

export type BoardKind = "kanban" | "dataTable";
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
/** Checks a whole view against its board's fields and returns it with settings of the board's kind. */
export const validateBoardView = (kind: BoardKind, view: ViewDraft, fields: BoardField[]) => {
  const settings =
    kind === "kanban"
      ? validateKanbanSettings(view.settings, fields)
      : validateDataTableSettings(view.settings, fields);
  const problem = findViewFilterProblem(view.filter, fields) ?? findViewSortsProblem(view.sorts, fields);
  if (problem) throw new BoardViewError(problem);
  return { settings, filter: view.filter, sorts: view.sorts };
};
