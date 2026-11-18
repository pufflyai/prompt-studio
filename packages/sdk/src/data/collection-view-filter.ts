import type { CollectionPageRequest } from "pstdio-api-contracts/extension-kernel";
import {
  normalizeBooleanViewRule,
  type StoragePredicate,
  VIEW_FILTER_CONDITIONS,
  type ViewFieldKind,
  type ViewFilterGroup,
  type ViewFilterRule,
} from "pstdio-api-contracts/extension-kernel";
import { collectionDatePredicate } from "./collection-view-date";
import { scalarViewValues } from "./collection-view-values";

export interface CollectionQueryField {
  field: string;
  kind: ViewFieldKind;
  sortable?: boolean;
  filterable?: boolean;
  options?: { value: string; label: string }[];
  /** The localized empty-group key sent by the renderer. */
  emptyGroup?: string;
  legacyValues?: Record<string, boolean>;
  filter?: (rule: ViewFilterRule) => StoragePredicate | undefined;
  search?: (text: string) => StoragePredicate;
  orderField?: string;
  date?: { dayField?: string; textField?: string };
}

const negate = (predicate: StoragePredicate): StoragePredicate => ({ not: predicate });
const booleanCondition = (field: CollectionQueryField, rule: ViewFilterRule) => {
  if (field.kind !== "boolean") return rule;
  return normalizeBooleanViewRule(rule, { kind: "boolean", legacyValues: field.legacyValues });
};

const supportedCondition = (kind: ViewFieldKind, rule: ViewFilterRule) => {
  const { condition, value } = rule;
  if (VIEW_FILTER_CONDITIONS[kind].includes(condition)) return condition;
  const equivalents = {
    "is-any-of": "has-any-of",
    "has-any-of": "is-any-of",
    "is-none-of": "has-none-of",
    "has-none-of": "is-none-of",
  } as const;
  const equivalent = equivalents[condition as keyof typeof equivalents];
  if (equivalent && VIEW_FILTER_CONDITIONS[kind].includes(equivalent)) return equivalent;
  return kind !== "boolean" && Array.isArray(value) && ["is-any-of", "is-none-of"].includes(condition)
    ? condition
    : undefined;
};
const arrayPredicate = (
  { field, kind }: CollectionQueryField,
  condition: ViewFilterRule["condition"],
  value: string[],
) => {
  if (!value.length) return undefined;
  if (kind !== "enum-multi")
    return {
      field,
      op: condition.includes("none") ? "notIn" : "in",
      value: scalarViewValues(kind, value),
    } satisfies StoragePredicate;
  const matched: StoragePredicate = { field, op: condition === "has-all-of" ? "containsAll" : "overlaps", value };
  return condition === "has-none-of" ? negate(matched) : matched;
};
const stringPredicate = (field: string, condition: ViewFilterRule["condition"], value: string) => {
  if (!value) return undefined;
  const matched: StoragePredicate = {
    field,
    op: condition.includes("contain") ? "textContains" : "equalsIgnoreCase",
    value,
  };
  return ["does-not-contain", "is-not"].includes(condition) ? negate(matched) : matched;
};
const scalarPredicate = (descriptor: CollectionQueryField, rule: ViewFilterRule, page?: CollectionPageRequest) => {
  const { field, kind } = descriptor;
  const { condition, value } = rule;
  if (kind === "string" && typeof value === "string") return stringPredicate(field, condition, value);
  if ((kind === "boolean" && typeof value === "boolean") || (kind === "number" && typeof value === "number")) {
    const ops = { is: "eq", "is-not": "ne", gt: "gt", gte: "gte", lt: "lt", lte: "lte" } as const;
    const op = ops[condition as keyof typeof ops];
    return op ? ({ field, op, value } satisfies StoragePredicate) : undefined;
  }
  if (kind === "date" && typeof value === "string") return collectionDatePredicate(descriptor, rule, page);
  return undefined;
};
export const collectionRulePredicate = (
  descriptor: CollectionQueryField,
  input: ViewFilterRule,
  page?: CollectionPageRequest,
) => {
  const rule = booleanCondition(descriptor, input);
  const condition = supportedCondition(descriptor.kind, rule);
  if (!condition) return undefined;
  if (descriptor.filter) return descriptor.filter({ ...rule, condition });
  if (condition === "is-empty" || condition === "is-not-empty")
    return { field: descriptor.field, op: condition === "is-empty" ? "empty" : "notEmpty" } satisfies StoragePredicate;
  if (Array.isArray(rule.value)) return arrayPredicate(descriptor, condition, rule.value);
  return scalarPredicate(descriptor, { ...rule, condition }, page);
};

export const collectionFilterPredicate = (
  fields: Record<string, CollectionQueryField>,
  group?: ViewFilterGroup,
  page?: CollectionPageRequest,
): StoragePredicate | undefined => {
  if (!group) return undefined;
  const rules = group.rules.flatMap((rule) => {
    const field = fields[rule.attributeId];
    const predicate = field && field.filterable !== false ? collectionRulePredicate(field, rule, page) : undefined;
    return predicate ? [predicate] : [];
  });
  for (const child of group.groups ?? []) {
    const predicate = collectionFilterPredicate(fields, child, page);
    if (predicate) rules.push(predicate);
  }
  if (!rules.length) return undefined;
  return group.conjunction === "or" ? { any: rules } : { all: rules };
};

export const collectionSearchPredicate = (descriptor: CollectionQueryField, search: string): StoragePredicate => {
  if (descriptor.search) return descriptor.search(search);
  const { field, kind, options = [] } = descriptor;
  if (kind === "enum" || kind === "enum-multi") {
    const values = options
      .filter((option) => option.label.toLowerCase().includes(search))
      .map((option) => option.value);
    const known = options.map(({ value }) => value);
    if (kind === "enum-multi")
      return {
        any: [
          { field, op: "overlaps", value: values },
          {
            test: {
              each: { field },
              as: "member",
              mode: "some",
              where: {
                op: "and",
                args: [
                  {
                    op: "not",
                    args: [
                      {
                        get: { literal: Object.fromEntries(known.map((value) => [value, true])) },
                        key: { variable: "member" },
                      },
                    ],
                  },
                  { op: "textContains", args: [{ variable: "member" }, { literal: search }] },
                ],
              },
            },
          },
        ],
      };
    return {
      any: [
        { field, op: "in", value: values },
        {
          all: [
            { field, op: "notIn", value: known },
            { field, op: "textContains", value: search },
          ],
        },
      ],
    };
  }
  if (kind === "date") {
    if (!descriptor.date?.textField) throw new Error("Date search needs its indexed calendar text projection");
    return { field: descriptor.date.textField, op: "textContains", value: search };
  }
  if (kind === "boolean")
    return { field, op: "in", value: [true, false].filter((value) => String(value).includes(search)) };
  return { field, op: "textContains", value: search };
};
