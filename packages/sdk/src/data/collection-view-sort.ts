import type {
  StorageComputedField,
  StorageExpression,
  StorageRecordQuery,
} from "pstdio-api-contracts/extension-kernel";
import type { CollectionViewSelection } from "./collection-view";
import { collectionViewer } from "./collection-view-date";
import type { CollectionQueryField } from "./collection-view-filter";

const blank = (value: StorageExpression): StorageExpression => ({
  op: "or",
  args: [
    { op: "missing", args: [value] },
    { op: "eq", args: [value, { literal: null }] },
    { op: "eq", args: [value, { literal: "" }] },
  ],
});
const enumRankField = (field: CollectionQueryField, source?: StorageComputedField): StorageComputedField => {
  const values = new Map((field.options ?? []).map(({ value }, i) => [value, i]));
  const rank = (value: unknown) =>
    typeof value !== "string" || !value ? null : (values.get(value) ?? values.size + 1);
  if (source?.cases)
    return {
      type: "number",
      cases: source.cases.map((entry) => ({ ...entry, value: rank(entry.value) })),
      otherwise: rank(source.otherwise),
    };
  const value: StorageExpression = source?.expression ?? { field: field.field };
  const selected: StorageExpression = { get: { literal: Object.fromEntries(values) }, key: value };
  return {
    type: "number",
    expression: {
      op: "if",
      args: [
        blank(value),
        { literal: null },
        {
          op: "if",
          args: [{ op: "missing", args: [selected] }, { literal: values.size + 1 }, selected],
        },
      ],
    },
  };
};
const textField = (field: CollectionQueryField, source?: StorageComputedField): StorageComputedField => {
  if (source?.cases)
    return {
      ...source,
      cases: source.cases.map((entry) => ({ ...entry, value: entry.value === "" ? null : entry.value })),
      otherwise: source.otherwise === "" ? null : source.otherwise,
    };
  const value: StorageExpression = source?.expression ?? { field: field.field };
  return { type: "string", expression: { op: "if", args: [blank(value), { literal: null }, value] } };
};

export const collectionSortSelection = (
  input: CollectionViewSelection,
  fields: Record<string, CollectionQueryField>,
) => {
  let orderBy = input.orderBy;
  let textOrder: StorageRecordQuery["textOrder"];
  const computed = { ...input.computed };
  const sort = input.sorts?.[0];
  if (!sort || fields[sort.attributeId]?.sortable === false || fields[sort.attributeId]?.kind === "enum-multi")
    return { orderBy, computed, textOrder };
  const descriptor = fields[sort.attributeId];
  if (!descriptor) return { orderBy, computed, textOrder };
  let field = descriptor.orderField ?? descriptor.field;
  if (!descriptor.orderField && descriptor.kind === "enum") {
    field = `@sort:${sort.attributeId}`;
    computed[field] = enumRankField(descriptor, computed[descriptor.field]);
  } else if (!descriptor.orderField && ["string", "user", "status"].includes(descriptor.kind)) {
    field = `@sort:${sort.attributeId}`;
    computed[field] = textField(descriptor, computed[descriptor.field]);
    textOrder = { field, locale: collectionViewer(input.page).locale };
  }
  orderBy = [{ field, direction: sort.direction }, ...(input.orderBy ?? []).filter((sort) => sort.field !== field)];
  return { orderBy, computed, textOrder };
};
