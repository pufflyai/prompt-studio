import {
  canonicalJson,
  fingerprint,
  type Json,
  type StorageAggregateQuery,
  type StorageRecord,
  type StorageRecordIndex,
} from "pstdio-sync-contracts";
import { createDecimalSum } from "./decimal-sum";
import type { QueryIdentities } from "./memory-query-identities";
import { aggregateOptions, compareAggregateGroups } from "./record-query-options";
import { recordQueryValue } from "./record-query-value";
import { memoryColumnStatistic } from "./record-statistics";

export const memoryRecordAggregate = async (
  index: StorageRecordIndex,
  query: StorageAggregateQuery,
  selected: StorageRecord[],
  revision: string,
  identities?: QueryIdentities,
  records: StorageRecord[] = selected,
  resolve?: (name: string) => StorageRecordIndex,
  read?: (index: StorageRecordIndex, record: StorageRecord, name: string) => Json | undefined,
) => {
  const readField = (record: StorageRecord, name: string) =>
    read ? read(index, record, name) : recordQueryValue(index, record, name, identities, records, resolve);
  const options = aggregateOptions(index, query);
  const metrics = () => ({
    values: Object.fromEntries(options.metrics.map(([name]) => [name, null])) as Record<string, number | null>,
    sums: Object.fromEntries(
      options.metrics.filter(([, metric]) => metric.operation === "sum").map(([name]) => [name, createDecimalSum()]),
    ),
  });
  const add = (state: ReturnType<typeof metrics>, record: StorageRecord) => {
    for (const [name, metric] of options.metrics) {
      const value = readField(record, metric.field);
      if (typeof value !== "number") continue;
      const previous = state.values[name];
      if (metric.operation === "sum") state.sums[name].add(value);
      else if (previous === null) state.values[name] = value;
      else if (metric.operation === "min") state.values[name] = Math.min(previous, value);
      else state.values[name] = Math.max(previous, value);
    }
  };
  const total = metrics();
  const groups = new Map<string, { value: Json; count: number; metrics: ReturnType<typeof metrics> }>();
  for (const record of selected) {
    add(total, record);
    if (!options.groupBy.length) continue;
    const fields = options.groupBy.map((field) => readField(record, field) ?? null);
    const value = typeof query.groupBy === "string" ? fields[0] : fields;
    const key = canonicalJson(value);
    const group = groups.get(key) ?? { value, count: 0, metrics: metrics() };
    group.count++;
    add(group.metrics, record);
    groups.set(key, group);
    if (options.groupLimit !== undefined && groups.size > options.groupLimit)
      throw new Error(`Aggregate has more than ${options.groupLimit} groups; narrow its selection`);
  }
  const resultMetrics = (state: ReturnType<typeof metrics>) =>
    query.metrics === undefined
      ? {}
      : {
          metrics: Object.fromEntries(
            options.metrics.map(([name, metric]) => [
              name,
              metric.operation === "sum" ? state.sums[name].value() : state.values[name],
            ]),
          ),
        };
  return {
    revision,
    count: selected.length,
    ...(query.statistics
      ? {
          statistics: Object.fromEntries(
            options.statistics.map(([name, statistic]) => [
              name,
              memoryColumnStatistic(
                selected.map((record) => ({ id: record.recordId, value: readField(record, statistic.field) })),
                statistic,
              ),
            ]),
          ),
        }
      : {}),
    ...resultMetrics(total),
    ...(query.fingerprint
      ? {
          fingerprint: await fingerprint(
            selected
              .slice()
              .sort((a, b) => {
                if (a.recordId === b.recordId) return 0;
                return a.recordId < b.recordId ? -1 : 1;
              })
              .map((record) => [
                record.recordId,
                ...query.fingerprint!.map((field) => readField(record, field) ?? null),
              ]),
          ),
        }
      : {}),
    groups: [...groups.values()]
      .map(({ value, count, metrics }) => ({ value, count, ...resultMetrics(metrics) }))
      .sort((a, b) => compareAggregateGroups(query, a.value, b.value)),
  };
};
