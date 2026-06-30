import type { DataRendererSettings } from "@pstdio/ui/data-renderer";
import {
  headerTrailingMenuPath,
  type WorkbenchModuleContribution,
  type WorkbenchModuleContributionContext,
} from "../../core";
import { AttributeEditor } from "./attribute-editor";
import {
  dataRendererStoryEditorWidgetId,
  dataRendererStoryRendererId,
  dataRendererStoryViewKind,
  dataRendererStoryWidgetId,
  type StoryRow,
  storyRows,
  storySchemaStore,
} from "./mock-data";

const configureAttributesCommandId = "data-renderer.story.configureAttributes";

const defaultSettings = {
  viewMode: "board",
  columnGrouping: "status",
  rowGrouping: "none",
  ordering: { attributeId: "updated", direction: "desc" },
  displayProperties: ["status", "assignee", "priority"],
} satisfies Partial<DataRendererSettings>;

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

const registerSchemaEditor = (ctx: WorkbenchModuleContributionContext) => {
  ctx.layout.registerWidget({
    id: dataRendererStoryEditorWidgetId,
    title: "Configure attributes",
    area: "overlay",
    singleton: true,
    closable: true,
    rendererId: dataRendererStoryEditorWidgetId,
    config: { size: "lg", placement: "center", scrollBehavior: "inside" },
  });
  ctx.renderers.registerRenderer({
    id: dataRendererStoryEditorWidgetId,
    render: () => <AttributeEditor />,
  });

  ctx.commands.registerCommand(
    {
      id: configureAttributesCommandId,
      label: "Configure attributes",
      category: "Data renderer",
      icon: "settings",
    },
    {
      execute: () => ctx.layout.openWidget(dataRendererStoryEditorWidgetId),
    },
  );
  ctx.layout.registerMenuItem(headerTrailingMenuPath("main"), {
    commandId: configureAttributesCommandId,
    group: "schema",
    order: 10,
  });
};

export const createDataRendererStoryModule = (): WorkbenchModuleContribution => ({
  id: "data-renderer.story",
  activate(ctx) {
    const rowsStore = createStoryRowsStore();

    ctx.renderers.registerDataRenderer({
      id: dataRendererStoryRendererId,
      title: "Rows",
      resourceKind: dataRendererStoryViewKind,
      attributes: storySchemaStore.source,
      defaultSettings,
      getBoardColumnConfig: resolveBoardColumnConfig,
      executeQuery: () => rowsStore.getRows(),
      subscribe: rowsStore.subscribe,
      onAttributeChange: rowsStore.updateAttribute,
      onReorder: rowsStore.reorder,
    });

    registerSchemaEditor(ctx);

    ctx.layout.registerWidget({
      id: dataRendererStoryWidgetId,
      title: "Rows",
      area: "main",
      rendererId: dataRendererStoryRendererId,
      singleton: true,
    });
    ctx.layout.openWidget(dataRendererStoryWidgetId, { title: "Rows" });
  },
});
