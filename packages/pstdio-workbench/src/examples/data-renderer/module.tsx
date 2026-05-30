import type { DataRendererSettings } from "@pstdio/ui";
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
    ctx.renderers.registerDataRenderer({
      id: dataRendererStoryRendererId,
      title: "Rows",
      resourceKind: dataRendererStoryViewKind,
      attributes: storySchemaStore.source,
      defaultSettings,
      getBoardColumnConfig: resolveBoardColumnConfig,
      executeQuery: () => storyRows,
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
