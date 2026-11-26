import { findViewFilterProblem } from "@pstdio/sdk/api";
import { EMPTY_VIEW_FILTER, filterRowsByView, type ViewFilterGroup } from "@pstdio/ui/collection-view";
import { machineStates } from "./machine-status";

const stateField = { id: "state", kind: "enum" as const, filterable: true, sortable: false, options: machineStates };

export const workspaceFilterFields = (label: string) => [
  { id: stateField.id, label, type: { kind: stateField.kind, options: machineStates }, filterable: true },
];

const states = machineStates.map(({ value, label }) => ({ id: value, title: label, attributes: { state: value } }));
const isGroup = (group: ViewFilterGroup) =>
  (group.conjunction === "and" || group.conjunction === "or") && Array.isArray(group.rules);

export function readWorkspaceFilter(value?: string) {
  if (!value) return EMPTY_VIEW_FILTER;
  try {
    const filter: ViewFilterGroup = JSON.parse(value);
    if (!isGroup(filter) || filter.groups?.some((group) => !isGroup(group) || "groups" in group))
      return EMPTY_VIEW_FILTER;
    return findViewFilterProblem(filter, [stateField]) ? EMPTY_VIEW_FILTER : filter;
  } catch {
    return EMPTY_VIEW_FILTER;
  }
}

export function allowedWorkspaceStates(filter: ViewFilterGroup, fields: ReturnType<typeof workspaceFilterFields>) {
  return filterRowsByView(states, filter, fields).map(({ id }) => id);
}
