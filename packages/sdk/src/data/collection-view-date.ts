import type {
  CollectionPageRequest,
  StorageComputedField,
  StorageDateFormat,
  StoragePredicate,
  StorageRecordQuery,
  ViewFilterGroup,
  ViewFilterRule,
} from "pstdio-api-contracts/extension-kernel";
import { formatViewDate } from "pstdio-sync-contracts";
import type { CollectionViewSelection } from "./collection-view";
import type { CollectionQueryField } from "./collection-view-filter";

export const collectionViewer = (page?: CollectionPageRequest) =>
  page?.viewer ?? {
    locale: Intl.DateTimeFormat().resolvedOptions().locale,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    now: new Date().toISOString(),
  };

const calendarTarget = (value: string, viewer: ReturnType<typeof collectionViewer>) => {
  const relative = /^today([+-]\d+)?$/.exec(value);
  if (relative) {
    const key = formatViewDate(viewer.now, { ...viewer, part: "day" });
    if (typeof key !== "number") return undefined;
    const year = Math.floor(key / 10000),
      month = Math.floor(key / 100) % 100,
      day = key % 100;
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day + Number(relative[1] ?? 0));
    return date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return formatViewDate(value, { ...viewer, part: "day" });
};

export const collectionDatePredicate = (
  field: CollectionQueryField,
  rule: ViewFilterRule,
  page?: CollectionPageRequest,
): StoragePredicate | undefined => {
  if (typeof rule.value !== "string") return undefined;
  const target = calendarTarget(rule.value, collectionViewer(page));
  if (target === undefined) return undefined;
  if (!field.date?.dayField) throw new Error("Date predicate needs a calendar projection");
  const operations = {
    is: "eq",
    "is-not": "ne",
    "is-before": "lt",
    "is-after": "gt",
    "is-on-or-before": "lte",
    "is-on-or-after": "gte",
  } as const;
  const op = operations[rule.condition as keyof typeof operations];
  return op ? { field: field.date.dayField, op, value: target } : undefined;
};

const dateRules = (group?: ViewFilterGroup): ViewFilterRule[] =>
  group ? [...group.rules, ...(group.groups ?? []).flatMap(dateRules)] : [];

const computedDateProjection = (
  id: string,
  source: StorageComputedField | undefined,
  format: Omit<StorageDateFormat, "field">,
): StorageComputedField | undefined => {
  if (!source) return undefined;
  const type = format.part === "text" ? "string" : "number";
  if (source.cases)
    return {
      type,
      cases: source.cases.map((entry) => ({ ...entry, value: formatViewDate(entry.value, format) ?? null })),
      otherwise: formatViewDate(source.otherwise, format) ?? null,
    };
  if (source.expression && "literal" in source.expression)
    return {
      type,
      expression: { literal: formatViewDate(source.expression.literal, format) ?? null },
    };
  throw new Error(`Computed date ${id} needs explicit dayField, textField and orderField projections for its controls`);
};

/** Only install projections a requested date control needs; installed local contexts survive view changes. */
export const collectionDateFields = (input: CollectionViewSelection) => {
  const fields = structuredClone(
    Object.fromEntries(
      Object.entries(input.fields).map(([key, field]) => [key, { ...field, filter: undefined, search: undefined }]),
    ),
  );
  // Preserve custom field callbacks, which are deliberately not serializable.
  for (const [key, field] of Object.entries(input.fields))
    Object.assign(fields[key], { filter: field.filter, search: field.search });
  for (const [key, presentation] of Object.entries(input.page?.presentation ?? {}))
    if (fields[key]) Object.assign(fields[key], presentation);
  const formats: NonNullable<StorageRecordQuery["formats"]> = { ...input.formats };
  const computed = { ...input.computed };
  const viewer = collectionViewer(input.page);
  const requirePart = (id: string, part: "day" | "text" | "timestamp") => {
    const field = fields[id];
    if (!field || field.kind !== "date") return;
    const existing = part === "timestamp" ? field.orderField : field.date?.[part === "day" ? "dayField" : "textField"];
    if (existing) return;
    const name = `@date:${id}:${part}`;
    const format = { locale: viewer.locale, timeZone: viewer.timeZone, part };
    const projection = computedDateProjection(id, computed[field.field], format);
    if (projection) computed[name] = projection;
    else formats[name] = { field: field.field, ...format };
    if (part === "timestamp") field.orderField = name;
    else field.date = { ...field.date, [part === "day" ? "dayField" : "textField"]: name };
  };
  for (const rule of dateRules(input.filter))
    if (
      !["is-empty", "is-not-empty", "is-any-of", "is-none-of"].includes(rule.condition) &&
      typeof rule.value === "string" &&
      calendarTarget(rule.value, viewer) !== undefined
    )
      requirePart(rule.attributeId, "day");
  if (input.page?.search.trim()) for (const id of input.searchFields ?? Object.keys(fields)) requirePart(id, "text");
  const sort = input.sorts?.[0];
  if (sort) requirePart(sort.attributeId, "timestamp");
  return { fields, formats, computed };
};
