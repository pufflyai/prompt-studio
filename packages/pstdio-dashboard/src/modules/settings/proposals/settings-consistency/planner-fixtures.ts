import type { TagEditorValue } from "@pstdio/ui";
import type { InputGroup } from "@pstdio/ui/param-editor";

export const plannerStatuses: TagEditorValue[] = [
  {
    id: "backlog",
    name: "Backlog",
    color: "gray",
    icon: "status-backlog",
    sortOrder: 0,
    isDefault: true,
    actions: ["create"],
  },
  { id: "todo", name: "Todo", color: "blue", icon: "status-todo", sortOrder: 1, actions: ["create"] },
  { id: "active", name: "In progress", color: "orange", icon: "status-progress", sortOrder: 2 },
  { id: "blocked", name: "Blocked", color: "red", icon: "status-canceled", sortOrder: 3 },
  { id: "done", name: "Done", color: "green", icon: "status-done", sortOrder: 4, actions: ["archive_all"] },
];

const options = plannerStatuses.map(({ id, name, icon, color }) => ({ id, name, icon: icon ?? undefined, color }));
export const plannerWorkflowGroup: InputGroup = {
  id: "workflow",
  title: "Planner workflow",
  params: [
    {
      id: "completedStatusIds",
      name: "Completed statuses",
      type: "selection",
      multiSelect: true,
      options,
      defaultValue: ["done"],
    },
    {
      id: "blockedStatusIds",
      name: "Blocked statuses",
      type: "selection",
      multiSelect: true,
      options,
      defaultValue: ["blocked"],
    },
    {
      id: "activeStatusIds",
      name: "Active statuses",
      type: "selection",
      multiSelect: true,
      options,
      defaultValue: ["active"],
    },
    {
      id: "mergeTargetStatusId",
      name: "Status after merge",
      type: "selection",
      options,
      clearable: true,
      defaultValue: "done",
    },
  ],
};

export interface PlannerTagDraft {
  id: string;
  name: string;
  type: string;
  options: TagEditorValue[];
}

export const plannerTags: PlannerTagDraft[] = [
  {
    id: "priority",
    name: "Priority",
    type: "single_select",
    options: [
      { id: "high", name: "High", color: "red", icon: "tag", sortOrder: 0 },
      { id: "medium", name: "Medium", color: "orange", icon: "tag", sortOrder: 1 },
      { id: "low", name: "Low", color: "blue", icon: "tag", sortOrder: 2 },
    ],
  },
  {
    id: "type",
    name: "Type",
    type: "multi_select",
    options: [
      { id: "bug", name: "Bug", color: "red", icon: "tag", sortOrder: 0 },
      { id: "feature", name: "Feature", color: "purple", icon: "tag", sortOrder: 1 },
    ],
  },
];
