import type { BoardField } from "pstdio-api-contracts";
import type { KanbanRendererFilterState, KanbanRendererSettings } from "pstdio-api-contracts/extension-kernel";

type ViewState = { settings: KanbanRendererSettings; filters: KanbanRendererFilterState };
export class BoardViewError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 503 = 400,
  ) {
    super(message);
  }
}
const idsFor = (fields: BoardField[], flag: "groupable" | "sortable" | "displayable" | "filterable") =>
  fields.filter((field) => field[flag]).map((field) => field.id);
export const validateBoardView = (view: ViewState, fields: BoardField[]) => {
  const valid = (value: string, flag: Parameters<typeof idsFor>[1], special: string[] = []) => {
    const ids = [...special, ...idsFor(fields, flag)];
    if (!ids.includes(value))
      throw new BoardViewError(`Invalid ${flag} field "${value}". Valid IDs: ${ids.join(", ")}`);
  };
  valid(view.settings.columnGrouping, "groupable", ["none"]);
  valid(view.settings.rowGrouping, "groupable", ["none"]);
  valid(view.settings.ordering.attributeId, "sortable", ["manual"]);
  for (const id of view.settings.displayProperties) valid(id, "displayable");
  for (const [id, values] of Object.entries(view.filters)) {
    valid(id, "filterable");
    const options = fields.find((field) => field.id === id)?.options;
    if (options && values.some((value) => !options.some((option) => option.value === value)))
      throw new BoardViewError(
        `Invalid filter value for "${id}". Valid values: ${options.map((option) => option.value).join(", ")}`,
      );
  }
};
export const cleanBoardView = (view: ViewState, fields: BoardField[], defaults: KanbanRendererSettings) => {
  const groupIds = ["none", ...idsFor(fields, "groupable")];
  const sortIds = ["manual", ...idsFor(fields, "sortable")];
  const group = (value: string, fallback: string) => {
    if (groupIds.includes(value)) return value;
    return groupIds.includes(fallback) ? fallback : "none";
  };
  const filters: KanbanRendererFilterState = {};
  for (const [id, values] of Object.entries(view.filters)) {
    const field = fields.find((field) => field.id === id && field.filterable);
    if (!field) continue;
    const kept = field.options
      ? values.filter((value) => field.options!.some((option) => option.value === value))
      : values;
    if (kept.length) filters[id] = kept;
  }
  const ordering = sortIds.includes(view.settings.ordering.attributeId)
    ? view.settings.ordering
    : {
        ...defaults.ordering,
        attributeId: sortIds.includes(defaults.ordering.attributeId) ? defaults.ordering.attributeId : "manual",
      };
  return {
    settings: {
      ...view.settings,
      columnGrouping: group(view.settings.columnGrouping, defaults.columnGrouping),
      rowGrouping: group(view.settings.rowGrouping, defaults.rowGrouping),
      ordering,
      displayProperties: view.settings.displayProperties.filter((id) => idsFor(fields, "displayable").includes(id)),
    },
    filters,
  };
};
