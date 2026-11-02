import { ResourceListRenderer, resourceListSettings } from "@pstdio/ui/kanban-renderer";
import { type ComponentProps, createElement } from "react";
import { WorkbenchKanbanView } from "../kanban/kanban-view";

/** Resource lists share collection queries, saved views, refresh and menus with kanban. */
export const renderWorkbenchResourceList = (props: ComponentProps<typeof WorkbenchKanbanView>) =>
  createElement(WorkbenchKanbanView, {
    ...props,
    contribution: {
      ...props.contribution,
      defaultSettings: resourceListSettings(props.contribution.defaultSettings ?? {}),
    },
    Renderer: ResourceListRenderer,
    resolveSettings: resourceListSettings,
  });
