import type { ReactNode } from "react";
import { KanbanRendererToolbar } from "../kanban-renderer/kanban-renderer-toolbar";
import type { AttributeDescriptor, KanbanRendererRow, KanbanRendererSavedView } from "../kanban-renderer/types";

interface DataTableHeaderProps {
  rows: KanbanRendererRow[];
  attributes: AttributeDescriptor[];
  storageKey: string;
  columnControl: ReactNode;
  defaultViews?: KanbanRendererSavedView[];
  defaultActiveViewId?: string;
}

export const DataTableHeader = (props: DataTableHeaderProps) => {
  const { rows, attributes, storageKey, columnControl, defaultViews, defaultActiveViewId } = props;

  return (
    <KanbanRendererToolbar
      rows={rows}
      storageKey={storageKey}
      attributes={attributes}
      defaultSettings={{ viewMode: "list" }}
      defaultViews={defaultViews}
      defaultActiveViewId={defaultActiveViewId}
      displayControl={columnControl}
    />
  );
};
