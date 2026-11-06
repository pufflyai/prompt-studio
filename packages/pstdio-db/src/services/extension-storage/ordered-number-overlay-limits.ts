import { type OrderedRecord, orderedBody } from "pstdio-sync/records";
import { assertStorageRecordByteLimits, isStorageLimitError, storageRecordBytes } from "pstdio-sync-contracts";
import { OrderedNumberLimitError, type OrderedNumberRepair } from "./ordered-number-limits";
import { orderedNumber } from "./ordered-number-values";

type NumberFact = { key: string; prefix: string; value: number; aliases: number };
type RecordFact = {
  recordId: string;
  deleted: boolean;
  bytes: number;
  version: number;
  number: NumberFact | undefined;
};
const keyFor = (number: NonNullable<ReturnType<typeof orderedNumber>>) =>
  JSON.stringify([number.extensionId, number.kind, number.prefix, number.value]);
const encoder = new TextEncoder();

/** Retain byte counts, never past JSON/Y states. Alias history is monotone under retainNumberHistory. */
export const createOrderedNumberAccounting = (canonical: Map<string, OrderedRecord>) => {
  const aliases = new Map<string, Map<string, number>>();
  const keys = new Map<string, string>();
  const groups: RecordFact[][] = [];
  const capture = (record: OrderedRecord, version: number) => {
    const number = orderedNumber(record);
    let fact: NumberFact | undefined;
    if (number) {
      const key = keyFor(number);
      if (!keys.has(key)) keys.set(key, key);
      const seen = aliases.get(record.recordId) ?? new Map<string, number>();
      for (const alias of number.aliases) if (!seen.has(alias)) seen.set(alias, version);
      aliases.set(record.recordId, seen);
      fact = { key: keys.get(key)!, prefix: number.prefix, value: number.value, aliases: number.aliases.length };
    }
    return {
      recordId: record.recordId,
      deleted: record.deleted,
      bytes: record.deleted ? 0 : storageRecordBytes(orderedBody(record)),
      version,
      number: fact,
    };
  };
  const base = new Map([...canonical.values()].map((record) => [record.recordId, capture(record, -1)]));
  const renamed = (fact: RecordFact, value: number) => {
    const number = fact.number!;
    // Renumbering changes only numeric digits and the union of the old/new shorthand aliases.
    let bytes = fact.bytes + String(value).length - String(number.value).length;
    let count = number.aliases;
    for (const alias of new Set([`${number.prefix}-${number.value}`, `${number.prefix}-${value}`])) {
      const firstSeen = aliases.get(fact.recordId)?.get(alias);
      if (firstSeen !== undefined && firstSeen <= fact.version) continue;
      bytes += encoder.encode(JSON.stringify(alias)).length + Number(count > 0);
      count++;
    }
    return { recordId: fact.recordId, deleted: fact.deleted, bytes };
  };
  return {
    add(records: OrderedRecord[]) {
      groups.push(records.map((record) => capture(record, groups.length)));
    },
    validate(repairs: OrderedNumberRepair[]) {
      const current = new Map(base);
      const changes = repairs.map((repair) => ({
        recordId: repair.before.recordId,
        key: keyFor(orderedNumber(repair.before)!),
        value: orderedNumber(repair.after)!.value,
        fallback: capture(repair.before, -1),
      }));
      for (const group of groups) {
        for (const fact of group) current.set(fact.recordId, fact);
        const related = changes.filter((change) => group.some((fact) => fact.number?.key === change.key));
        const writes = new Map(group.map((fact) => [fact.recordId, fact]));
        const materialized = new Map(
          group.map((fact) => [fact.recordId, { recordId: fact.recordId, deleted: fact.deleted, bytes: fact.bytes }]),
        );
        for (const change of related) {
          const fact = current.get(change.recordId) ?? change.fallback;
          if (fact.number?.key !== change.key) continue;
          writes.set(fact.recordId, fact);
          materialized.set(fact.recordId, renamed(fact, change.value));
        }
        try {
          assertStorageRecordByteLimits([...materialized.values()]);
        } catch (error) {
          if (!isStorageLimitError(error)) throw error;
          throw new OrderedNumberLimitError([...writes.keys()], error);
        }
      }
    },
  };
};
