import { ResourceListRenderer, resourceListSettings } from "@pstdio/ui/kanban-renderer";
import { type ComponentProps, createElement } from "react";
import { WorkbenchKanbanView } from "../kanban/kanban-view";

type Contribution = ComponentProps<typeof WorkbenchKanbanView>["contribution"];

// One list contribution per registered contribution, so re-renders keep its identity and bound placements.
const listContributions = new WeakMap<Contribution, Contribution>();

const listContribution = (contribution: Contribution) => {
  let list = listContributions.get(contribution);
  if (!list) {
    list = { ...contribution, defaultSettings: resourceListSettings(contribution.defaultSettings ?? {}) };
    listContributions.set(contribution, list);
  }
  return list;
};

/** Resource lists share collection queries, saved views, refresh and menus with kanban. */
export const renderWorkbenchResourceList = (props: ComponentProps<typeof WorkbenchKanbanView>) =>
  createElement(WorkbenchKanbanView, {
    ...props,
    contribution: listContribution(props.contribution),
    Renderer: ResourceListRenderer,
    resolveSettings: resourceListSettings,
  });
