import {
  canonicalJson,
  type Json,
  type StorageAggregateQuery,
  type StorageRecordIndex,
  type StorageStatisticResult,
} from "pstdio-sync-contracts";
import { histogramBucket, histogramResult } from "./record-histogram";
import { compareQueryValues } from "./record-query";
import { queryField } from "./record-query-field";
import { compareLocaleQueryText } from "./record-query-string-order";

export { histogramResult } from "./record-histogram";

type Statistic = NonNullable<StorageAggregateQuery["statistics"]>[string];
export const statisticOptions = (index: StorageRecordIndex, query: StorageAggregateQuery) => {
  const statistics = Object.entries(query.statistics ?? {});
  if (statistics.length > 16) throw new Error("Request at most 16 column statistics");
  for (const [name, statistic] of statistics) {
    if (!name || !["unique", "histogram", "top-values"].includes(statistic.type))
      throw new Error("Invalid column statistic");
    const field = queryField(index, statistic.field);
    if (["array", "object"].includes(field.type)) throw new Error("Column statistics need a scalar projection");
    if (statistic.type === "histogram" && field.type !== "number")
      throw new Error("Histogram statistics need a number projection");
    if (statistic.type === "histogram") validateCount(statistic.bins ?? 10);
    if (statistic.type === "top-values") {
      validateCount(statistic.limit ?? 2);
      if (statistic.locale !== undefined) new Intl.Collator(statistic.locale);
    }
  }
  return statistics;
};
const validateCount = (value: number) => {
  if (!Number.isInteger(value) || value < 1 || value > 100)
    throw new Error("Column statistics select 1 to 100 bins or top values");
};
export const topValuesResult = (groups: { label: string; count: number }[], total: number) => {
  const values = groups.map((group) => ({ ...group, percentage: Math.round((group.count / total) * 100) }));
  const other = total - groups.reduce((sum, group) => sum + group.count, 0);
  if (other) values.push({ label: "Other", count: other, percentage: Math.round((other / total) * 100) });
  return values;
};
export const memoryColumnStatistic = (
  source: { id: string; value: Json | undefined }[],
  statistic: Statistic,
): StorageStatisticResult => {
  const values = source.filter(({ value }) => value !== undefined && value !== null && value !== "");
  if (statistic.type === "unique")
    return { type: "unique", count: new Set(values.map(({ value }) => canonicalJson(value!))).size };
  if (statistic.type === "histogram") {
    const numbers = values.map(({ value }) => value).filter((value): value is number => typeof value === "number");
    if (!numbers.length) return { type: "histogram", histogram: null };
    const min = numbers.reduce((minimum, value) => Math.min(minimum, value), Infinity),
      max = numbers.reduce((maximum, value) => Math.max(maximum, value), -Infinity),
      bins = statistic.bins ?? 10;
    const counts = new Map<number, number>();
    for (const value of numbers) {
      const bucket = histogramBucket(value, min, max, bins);
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
    return { type: "histogram", histogram: histogramResult(min, max, bins, counts) };
  }
  const grouped = new Map<string, { label: string; count: number; first: string }>();
  for (const { id, value } of values) {
    const key = canonicalJson(value!);
    const group = grouped.get(key) ?? { label: String(value), count: 0, first: id };
    group.count++;
    if (compareQueryValues(id, group.first) < 0) group.first = id;
    grouped.set(key, group);
  }
  const top = [...grouped.values()]
    .sort(
      (a, b) =>
        b.count - a.count ||
        compareLocaleQueryText(a.label, b.label, statistic.locale, false) ||
        compareQueryValues(a.first, b.first),
    )
    .slice(0, statistic.limit ?? 2);
  return {
    type: "top-values",
    values: topValuesResult(
      top.map(({ label, count }) => ({ label, count })),
      values.length,
    ),
  };
};
