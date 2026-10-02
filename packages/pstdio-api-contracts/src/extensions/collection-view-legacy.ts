// Converts the deprecated kanban view fields (`filters`, `defaultFilters`, `settings.ordering`).
// Remove this file with them in the next breaking extension API release.
import type {
  KanbanRendererContribution,
  KanbanRendererFilterState,
  KanbanRendererSettings,
  ViewFieldKind,
  ViewFilterGroup,
  ViewFilterRule,
  ViewSort,
} from "../extension-kernel/types";
import { isViewFilterGroup } from "./collection-view";

type FieldKinds = Partial<Record<string, ViewFieldKind>>;
type Ordering = KanbanRendererSettings["ordering"];

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

/**
 * The old filter picked exact values for every field. Option fields keep "any of"; text, number,
 * and date fields become "is" rules, joined by "or" when several values were picked.
 */
export const legacyRuleFor = (
  attributeId: string,
  values: string[],
  kind: ViewFieldKind | undefined,
): ViewFilterRule | ViewFilterGroup | undefined => {
  if (kind === "enum-multi") return { attributeId, condition: "has-any-of", value: [...values] };
  if (kind !== "string" && kind !== "number" && kind !== "date")
    return { attributeId, condition: "is-any-of", value: [...values] };
  const rules = values.flatMap((value): ViewFilterRule[] => {
    if (kind === "string") return [{ attributeId, condition: "is", value }];
    if (kind === "number")
      return Number.isFinite(Number(value)) ? [{ attributeId, condition: "is", value: Number(value) }] : [];
    const day = ISO_DAY.exec(value)?.[0];
    return day ? [{ attributeId, condition: "is", value: day }] : [];
  });
  if (rules.length <= 1) return rules[0];
  return { conjunction: "or", rules };
};

export const viewFilterFromLegacyFilters = (
  filters: KanbanRendererFilterState | undefined,
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

/**
 * Root "any of" rules joined by "and" are each necessary, so narrowing a query by one of them never
 * drops a row the view shows. Every other rule is left to the renderer.
 */
export const legacyFiltersFromViewFilter = (filter: ViewFilterGroup) => {
  const filters: KanbanRendererFilterState = {};
  if (filter.conjunction !== "and") return filters;
  for (const rule of filter.rules) {
    if (isViewFilterGroup(rule) || filters[rule.attributeId]) continue;
    if (rule.condition !== "is-any-of" && rule.condition !== "has-any-of") continue;
    if (Array.isArray(rule.value) && rule.value.length > 0) filters[rule.attributeId] = [...rule.value];
  }
  return filters;
};

export const legacyOrderingFromSorts = (sorts: ViewSort[]): Ordering =>
  sorts[0] ? { ...sorts[0] } : { attributeId: "manual", direction: "asc" };

type KanbanViewDefaults = Pick<
  KanbanRendererContribution,
  "attributes" | "defaultSettings" | "defaultFilter" | "defaultFilters" | "defaultSorts" | "defaultViews"
>;

/** Reads a contribution's view defaults once, so hosts only ever see `filter` and `sorts`. */
export const normalizeKanbanViewDefaults = (body: KanbanViewDefaults) => {
  const kinds: FieldKinds = Object.fromEntries((body.attributes ?? []).map((field) => [field.id, field.type.kind]));
  const { ordering, ...defaultSettings } = body.defaultSettings ?? {};
  return {
    defaultSettings,
    defaultFilter: body.defaultFilter ?? viewFilterFromLegacyFilters(body.defaultFilters, kinds),
    defaultSorts: body.defaultSorts ?? viewSortsFromLegacyOrdering(ordering),
    defaultViews: body.defaultViews?.map(({ filters, settings, ...view }) => {
      const { ordering: viewOrdering, ...viewSettings } = settings;
      return {
        ...view,
        settings: viewSettings,
        filter: view.filter ?? viewFilterFromLegacyFilters(filters, kinds),
        sorts: view.sorts ?? viewSortsFromLegacyOrdering(viewOrdering),
      };
    }),
  };
};
