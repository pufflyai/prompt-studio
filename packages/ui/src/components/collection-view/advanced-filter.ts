import type { ViewFilterGroup } from "@pstdio/sdk/extensions";

/** Existing whole-view OR filters appear as one advanced bubble without changing their meaning. */
export const normalFilter = (filter: ViewFilterGroup): ViewFilterGroup =>
  filter.conjunction === "or"
    ? { conjunction: "and", rules: [], groups: [{ conjunction: "or", rules: filter.rules }] }
    : filter;

export const setAdvancedGroup = (filter: ViewFilterGroup, index: number, group?: ViewFilterGroup): ViewFilterGroup => {
  const groups = filter.groups ?? [];
  const next =
    group === undefined
      ? groups.filter((_, entry) => entry !== index)
      : groups.map((entry, position) => (position === index ? group : entry));
  const { groups: _groups, ...normal } = filter;
  return next.length ? { ...normal, groups: next } : normal;
};

export const addAdvancedGroup = (filter: ViewFilterGroup): ViewFilterGroup => ({
  ...filter,
  groups: [...(filter.groups ?? []), { conjunction: "and", rules: [] }],
});
