import type {
  DataTableRendererColumn,
  DataTableRendererSettings,
  KanbanRendererSettings,
} from "@pstdio/sdk/extensions";
import type { AttributeDescriptor } from "@pstdio/ui/kanban-renderer";

export const tablePageFields = (
  columns: Pick<DataTableRendererColumn, "id" | "hidden">[],
  settings: Pick<DataTableRendererSettings, "hiddenColumns" | "grouping">,
) =>
  columns
    .filter(
      (column) => column.id === settings.grouping || (!column.hidden && !settings.hiddenColumns.includes(column.id)),
    )
    .map((column) => column.id);

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
