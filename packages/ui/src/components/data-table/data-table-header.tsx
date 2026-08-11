import type { ReactNode } from "react";
import { KanbanRendererToolbar } from "../kanban-renderer/kanban-renderer-toolbar";
import type { AttributeDescriptor, KanbanRendererRow } from "../kanban-renderer/types";

interface DataTableHeaderProps {
  rows: KanbanRendererRow[];
  attributes: AttributeDescriptor[];
  storageKey: string;
  columnControl: ReactNode;
}

export const DataTableHeader = (props: DataTableHeaderProps) => {
  const { rows, attributes, storageKey, columnControl } = props;

  return (
    <KanbanRendererToolbar
      rows={rows}
      storageKey={storageKey}
      attributes={attributes}
      defaultSettings={{ viewMode: "list" }}
      displayControl={columnControl}
    />
  );
};
