import type { Json, StorageRecordIndex, StorageRecordQuery } from "pstdio-sync-contracts";
import { queryField } from "./record-query-field";
import { compareLocaleQueryText } from "./record-query-string-order";

export const recordQueryTextOrders = new WeakMap<StorageRecordIndex, NonNullable<StorageRecordQuery["textOrder"]>>();

export const withRecordQueryTextOrder = (index: StorageRecordIndex, textOrder?: StorageRecordQuery["textOrder"]) => {
  if (!textOrder) return index;
  if (
    queryField(index, textOrder.field).type !== "string" ||
    !index.orderBy?.some(({ field }) => field === textOrder.field)
  )
    throw new Error("Text ordering needs a sorted string field");
  if (typeof textOrder.locale !== "string" || !textOrder.locale || textOrder.locale.length > 128)
    throw new Error("Text ordering needs a viewer locale");
  const locale = new Intl.Collator(textOrder.locale, { numeric: true, sensitivity: "base" }).resolvedOptions().locale;
  const requested = { ...index };
  recordQueryTextOrders.set(requested, { field: textOrder.field, locale });
  return requested;
};

export const compareRecordQueryText = (
  index: StorageRecordIndex,
  field: string,
  left: Json | undefined,
  right: Json | undefined,
) => {
  const order = recordQueryTextOrders.get(index);
  if (order?.field !== field || typeof left !== "string" || typeof right !== "string") return undefined;
  return compareLocaleQueryText(left, right, order.locale);
};
