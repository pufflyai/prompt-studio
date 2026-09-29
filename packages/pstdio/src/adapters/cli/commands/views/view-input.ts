import type { BoardField, BoardViewUpdate } from "@pstdio/sdk/api";
export interface ViewFlags {
  title?: string;
  filter?: string[];
  mode?: string;
  columns?: string;
  rows?: string;
  sort?: string;
  show?: string;
}
const buildSettings = (flags: ViewFlags) => {
  const settings: NonNullable<BoardViewUpdate["settings"]> = {};
  if (flags.mode !== undefined) {
    if (flags.mode !== "board" && flags.mode !== "list") throw new Error("Mode must be board or list");
    settings.viewMode = flags.mode;
  }
  if (flags.columns !== undefined) settings.columnGrouping = flags.columns;
  if (flags.rows !== undefined) settings.rowGrouping = flags.rows;
  if (flags.show !== undefined) settings.displayProperties = flags.show.split(",").filter(Boolean);
  if (flags.sort !== undefined) {
    const [attributeId, direction, extra] = flags.sort.split(":");
    if (!attributeId || extra || (direction !== "asc" && direction !== "desc"))
      throw new Error("Sort must be <field>:asc|desc");
    settings.ordering = { attributeId, direction };
  }
  return settings;
};
const resolveFilterValue = (field: BoardField, value: string) => {
  if (!field.options || field.options.some((option) => option.value === value)) return value;
  const matches = field.options.filter((option) => option.label === value);
  if (matches.length > 1)
    throw new Error(`Ambiguous label "${value}". Matching values: ${matches.map((option) => option.value).join(", ")}`);
  if (!matches.length)
    throw new Error(
      `Invalid value "${value}". Valid values: ${field.options.map((option) => option.value).join(", ")}`,
    );
  return matches[0].value;
};
const buildFilters = (values: string[], fields: BoardField[]) => {
  const filters: Record<string, string[]> = {};
  for (const filter of values) {
    const split = filter.indexOf("=");
    if (split < 1) throw new Error("Filter must be <field>=<value>");
    const id = filter.slice(0, split);
    const field = fields.find((field) => field.id === id && field.filterable);
    if (!field)
      throw new Error(
        `Invalid filter field "${id}". Valid IDs: ${fields
          .filter((field) => field.filterable)
          .map((field) => field.id)
          .join(", ")}`,
      );
    filters[id] = [...(filters[id] ?? []), resolveFilterValue(field, filter.slice(split + 1))];
  }
  return filters;
};
export const buildViewInput = (flags: ViewFlags, fields: BoardField[]) => {
  const input: BoardViewUpdate = {};
  if (flags.title !== undefined) input.title = flags.title;
  const settings = buildSettings(flags);
  if (Object.keys(settings).length) input.settings = settings;
  if (flags.filter) input.filters = buildFilters(flags.filter, fields);
  return input;
};
