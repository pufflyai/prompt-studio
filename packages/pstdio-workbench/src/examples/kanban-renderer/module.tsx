import type { KanbanRendererSettings } from "@pstdio/ui/kanban-renderer";
import { headerTrailingMenuPath, type WorkbenchModuleContext, type WorkbenchModuleContribution } from "../../core";
import { AttributeEditor } from "./attribute-editor";
import {
  kanbanRendererStoryEditorWidgetId,
  kanbanRendererStoryRendererId,
  kanbanRendererStoryViewKind,
  kanbanRendererStoryWidgetId,
  type StoryRow,
  storyRows,
  storySchemaStore,
} from "./mock-data";

const configureAttributesCommandId = "kanban-renderer.story.configureAttributes";

const defaultSettings = {
  viewMode: "board",
  columnGrouping: "status",
  rowGrouping: "none",
  ordering: { attributeId: "updated", direction: "desc" },
  displayProperties: ["status", "assignee", "priority"],
} satisfies Partial<KanbanRendererSettings>;

const resolveBoardColumnConfig = (groupKey: string) => {
  const status = storySchemaStore.getAttributes().find((attribute) => attribute.id === "status");
  if (!status || status.type.kind !== "enum") {
    return { color: "gray", canDragIn: true, canDragOut: true, canCreate: true };
  }
  const options = Array.isArray(status.type.options) ? status.type.options : status.type.options.getSnapshot();
  const option = options.find((entry) => entry.value === groupKey);
  if (!option) return { color: "gray", canDragIn: true, canDragOut: true, canCreate: true };
  return { color: option.color, canDragIn: true, canDragOut: true, canCreate: true };
};

const reorderRows = (items: StoryRow[], rowId: string, beforeRowId?: string) => {
  const moving = items.find((row) => row.id === rowId);
  if (!moving) return items;

  const remaining = items.filter((row) => row.id !== rowId);
  const beforeIndex = beforeRowId ? remaining.findIndex((row) => row.id === beforeRowId) : -1;
  const insertIndex = beforeIndex === -1 ? remaining.length : beforeIndex;

  return [...remaining.slice(0, insertIndex), moving, ...remaining.slice(insertIndex)];
};

const createStoryRowsStore = () => {
  let rows = storyRows;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  return {
    getRows: () => rows,
    updateAttribute: (rowId: string, attributeId: string, value: unknown) => {
      rows = rows.map((row) =>
        row.id === rowId ? { ...row, attributes: { ...row.attributes, [attributeId]: value } } : row,
      );
      notify();
    },
    reorder: (rowId: string, beforeRowId?: string) => {
      rows = reorderRows(rows, rowId, beforeRowId);
      notify();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

const registerSchemaEditor = (ctx: WorkbenchModuleContext) => {
  ctx.layout.registerPanel({
    id: kanbanRendererStoryEditorWidgetId,
    title: "Configure attributes",
    region: "overlay",
    singleton: true,
    closable: true,
    rendererId: kanbanRendererStoryEditorWidgetId,
    config: { size: "lg", placement: "center", scrollBehavior: "inside" },
  });
  ctx.renderers.registerRenderer({
    id: kanbanRendererStoryEditorWidgetId,
    render: () => <AttributeEditor />,
  });

  ctx.commands.registerCommand(
    {
      id: configureAttributesCommandId,
      label: "Configure attributes",
      category: "Kanban renderer",
      icon: "settings",
    },
    {
      execute: () => ctx.layout.openPanel(kanbanRendererStoryEditorWidgetId),
    },
  );
  ctx.layout.registerMenuItem(headerTrailingMenuPath("main"), {
    commandId: configureAttributesCommandId,
    group: "schema",
    order: 10,
  });
};

export const createKanbanRendererStoryModule = (): WorkbenchModuleContribution => ({
  id: "kanban-renderer.story",
  activate(ctx) {
    const rowsStore = createStoryRowsStore();

    ctx.renderers.registerKanbanRenderer({
      id: kanbanRendererStoryRendererId,
      title: "Rows",
      resourceKind: kanbanRendererStoryViewKind,
      attributes: storySchemaStore.source,
      defaultSettings,
      getBoardColumnConfig: resolveBoardColumnConfig,
      executeQuery: () => rowsStore.getRows(),
      subscribe: rowsStore.subscribe,
      onAttributeChange: rowsStore.updateAttribute,
      onReorder: rowsStore.reorder,
    });

    registerSchemaEditor(ctx);

    ctx.layout.registerPanel({
      closable: false,
      id: kanbanRendererStoryWidgetId,
      title: "Rows",
      region: "main",
      rendererId: kanbanRendererStoryRendererId,
      singleton: true,
    });
    ctx.layout.openPanel(kanbanRendererStoryWidgetId, { title: "Rows" });
  },
});
