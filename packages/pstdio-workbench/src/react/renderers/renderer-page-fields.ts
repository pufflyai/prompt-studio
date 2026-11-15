import type {
  CollectionPageRequest,
  DataTableRendererColumn,
  DataTableRendererSettings,
  KanbanRendererSettings,
} from "@pstdio/sdk/extensions";
import { type AttributeDescriptor, getEnumOptions } from "@pstdio/ui/kanban-renderer";

export const rendererPagePresentation = (
  fields: { id: string; label?: string; type?: AttributeDescriptor["type"] }[],
): CollectionPageRequest["presentation"] =>
  Object.fromEntries(
    fields.map((field) => [
      field.id,
      {
        emptyGroup: `No ${(field.label ?? field.id).toLowerCase()}`,
        ...(field.type && "options" in field.type
          ? { options: getEnumOptions(field.type).map(({ value, label }) => ({ value, label })) }
          : {}),
      },
    ]),
  );

export const tablePageFields = (
  columns: Pick<DataTableRendererColumn, "id" | "hidden">[],
  settings: Pick<DataTableRendererSettings, "hiddenColumns" | "grouping">,
) =>
  columns
    .filter(
      (column) => column.id === settings.grouping || (!column.hidden && !settings.hiddenColumns.includes(column.id)),
    )
    .map((column) => column.id);

export const tableSearchFields = (
  columns: Pick<DataTableRendererColumn, "id" | "hidden">[],
  settings: Pick<DataTableRendererSettings, "hiddenColumns">,
) => columns.filter((column) => !column.hidden && !settings.hiddenColumns.includes(column.id)).map(({ id }) => id);

export const kanbanSearchFields = (settings: Pick<KanbanRendererSettings, "displayProperties" | "viewMode">) => [
  ...new Set(["title", ...settings.displayProperties, ...(settings.viewMode === "list" ? ["id"] : [])]),
];

export const kanbanPageFields = (
  attributes: Pick<AttributeDescriptor, "id" | "display">[],
  settings: Pick<KanbanRendererSettings, "displayProperties" | "columnGrouping" | "rowGrouping" | "viewMode">,
) => {
  const fields = new Set(["title", ...settings.displayProperties, settings.columnGrouping, settings.rowGrouping]);
  fields.delete("none");
  if (settings.viewMode === "list") fields.add("id");
  for (const attribute of attributes) {
    if (fields.has(attribute.id) && attribute.display?.kind === "badge-list")
      fields.add(attribute.display.itemsAttributeId);
  }
  return [...fields];
};
