import type { ViewFieldKind, ViewFilterGroup, ViewFilterRule, ViewSort } from "pstdio-api-contracts/extension-kernel";

type FieldKinds = Partial<Record<string, ViewFieldKind>>;
export type LegacyFilterMap = Record<string, string[]>;
export type LegacyOrdering = { attributeId: string; direction: "asc" | "desc" };
type Ordering = LegacyOrdering;

/** Deprecated filter maps use exact membership, with OR within each field's selected values. */
export const legacyRuleFor = (
  attributeId: string,
  values: string[],
  kind: ViewFieldKind | undefined,
): ViewFilterRule => ({
  attributeId,
  condition: kind === "enum-multi" ? "has-any-of" : "is-any-of",
  value: [...values],
});

export const viewFilterFromLegacyFilters = (
  filters: LegacyFilterMap | undefined,
  kinds: FieldKinds = {},
): ViewFilterGroup => ({
  conjunction: "and",
  rules: Object.entries(filters ?? {}).flatMap(([attributeId, values]) => {
    const rule = values.length > 0 ? legacyRuleFor(attributeId, values, kinds[attributeId]) : undefined;
    return rule ? [rule] : [];
  }),
});

export const viewSortsFromLegacyOrdering = (ordering: Ordering | undefined): ViewSort[] =>
  !ordering || ordering.attributeId === "manual"
    ? []
    : [{ attributeId: ordering.attributeId, direction: ordering.direction }];
