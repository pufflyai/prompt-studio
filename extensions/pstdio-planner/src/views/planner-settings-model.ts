import { diffEditingState } from "@pstdio/sdk/extensions";
import type { TagEditorValue } from "@pstdio/ui";
import type { StoredTag } from "../data/types";
import type { TicketStatusDraft } from "../ticket-status-settings";

export interface PlannerSettingsGroup {
  id: string;
  name: string;
  type?: "single_select" | "multi_select";
  sortOrder?: number;
  defaultValueId?: string | null;
  values: TagEditorValue[];
}
interface SettingsOption extends TagEditorValue {
  deleted?: boolean;
}
interface SettingsGroup extends Omit<PlannerSettingsGroup, "values"> {
  values: Record<string, SettingsOption>;
  deleted?: boolean;
}
export interface PlannerSettingsState {
  groups: Record<string, SettingsGroup>;
}
export type PlannerSettingsKind = "status" | "tags";
const byOrder = (a: { sortOrder?: number }, b: { sortOrder?: number }) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
const optionMap = (values: TagEditorValue[]) => Object.fromEntries(values.map((value) => [value.id, value]));
export const statusSettingsState = (statuses: TicketStatusDraft[]): PlannerSettingsState => ({
  groups: {
    statuses: {
      id: "statuses",
      name: "Ticket status",
      defaultValueId: statuses.find((status) => status.isDefault)?.id ?? statuses[0]?.id ?? null,
      values: optionMap(statuses.map(({ label, isDefault: _default, ...value }) => ({ ...value, name: label }))),
    },
  },
});
export const tagSettingsState = (tags: StoredTag[]): PlannerSettingsState => ({
  groups: Object.fromEntries(tags.map(({ options, ...tag }) => [tag.id, { ...tag, values: optionMap(options) }])),
});
export const plannerSettingsGroups = (state: PlannerSettingsState): PlannerSettingsGroup[] =>
  Object.values(state.groups)
    .filter((group) => !group.deleted && group.id && group.values)
    .sort(byOrder)
    .map((group) => ({
      ...group,
      values: Object.values(group.values)
        .filter((value) => !value.deleted && value.id)
        .sort(byOrder)
        .map((value) =>
          group.defaultValueId === undefined ? value : { ...value, isDefault: value.id === group.defaultValueId },
        ),
    }));

/** Keep deleted entries as tombstones so diffs never replace an entire shared collection. */
export const editPlannerSettings = (state: PlannerSettingsState, groups: PlannerSettingsGroup[]) => {
  const next = structuredClone(state);
  for (const [id, group] of Object.entries(next.groups))
    if (!groups.some((entry) => entry.id === id)) group.deleted = true;
  for (const group of groups) {
    const values = { ...next.groups[group.id]?.values };
    for (const [id, value] of Object.entries(values))
      if (!group.values.some((entry) => entry.id === id)) values[id] = { ...value, deleted: true };
    const hasDefault = "defaultValueId" in (next.groups[group.id] ?? group);
    for (const value of group.values) {
      const { isDefault: _default, ...option } = value;
      values[value.id] = hasDefault ? option : value;
    }
    next.groups[group.id] = {
      ...group,
      values,
      ...(hasDefault
        ? { defaultValueId: group.values.find((value) => value.isDefault)?.id ?? group.values[0]?.id ?? null }
        : {}),
    };
  }
  return diffEditingState(state, JSON.parse(JSON.stringify(next)));
};

export const assertPlannerSettingsState = (state: PlannerSettingsState) => {
  for (const [id, group] of Object.entries(state.groups)) {
    if (group.deleted) continue;
    if (group.id !== id || !group.name || !group.values)
      throw new Error("A tag or option was removed elsewhere. Reset changes and try again.");
    if (
      group.defaultValueId != null &&
      (!group.values[group.defaultValueId] || group.values[group.defaultValueId].deleted)
    )
      throw new Error("The selected default status was removed elsewhere. Reset changes and choose another default.");
    for (const [id, value] of Object.entries(group.values)) {
      if (!value.deleted && (value.id !== id || !value.name || !value.color))
        throw new Error("A tag or option was removed elsewhere. Reset changes and try again.");
    }
  }
};
