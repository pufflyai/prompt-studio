import type { OrderedOperation, OrderedRecord } from "pstdio-sync/records";
import { assertOrderedNumberLimits, type OrderedNumberRepair } from "./ordered-number-limits";
import {
  orderedNumber,
  renumberOrderedRecord,
  retainNumberHistory,
  supplementNumberIntent,
} from "./ordered-number-values";

export class OrderedNumberRangeError extends Error {
  constructor(
    prefix: string,
    readonly resourceIds: string[] = [],
  ) {
    super(`Resource number range exhausted for prefix ${prefix}`);
    this.name = "OrderedNumberRangeError";
  }
}

export interface OrderedNumberIndex {
  read(ids: string[]): Promise<Map<string, OrderedRecord>>;
  save(records: OrderedRecord[]): Promise<void>;
  collisions(records: OrderedRecord[]): Promise<string[]>;
  next(prefix: string): Promise<number>;
  preferred?(record: OrderedRecord): Promise<number | undefined>;
  repairStamp?(record: OrderedRecord, value: number): Promise<string>;
  validate?(records: OrderedRecord[], repairs: OrderedNumberRepair[]): Promise<void>;
}

/** The same repair policy runs against SQL canonical claims, staged claims, or local optimistic claims. */
export const repairOrderedNumbers = async (
  index: OrderedNumberIndex,
  input: OrderedRecord[],
  operation?: OrderedOperation,
  stamp = JSON.stringify(["canonical", "initial", "number-repair"]),
) => {
  const ids = input.map((record) => record.recordId);
  if (operation) for (const edit of operation.edits) if (!ids.includes(edit.recordId)) ids.push(edit.recordId);
  const before = await index.read(ids);
  const records = operation ? supplementNumberIntent(before, input, operation) : input;
  const final = new Map(
    records.map((record) => [
      record.recordId,
      retainNumberHistory(before.get(record.recordId), record, operation ? stamp : undefined),
    ]),
  );
  await index.save([...final.values()]);
  const collisions = await index.collisions([...final.values()]);
  const repairs: OrderedNumberRepair[] = [];
  for (const id of collisions) {
    const record = final.get(id) ?? (await index.read([id])).get(id);
    if (!record || !orderedNumber(record)) continue;
    const number = orderedNumber(record)!;
    const value = (await index.preferred?.(record)) ?? (await index.next(number.prefix));
    if (!Number.isSafeInteger(value)) throw new OrderedNumberRangeError(number.prefix, collisions);
    const repaired = renumberOrderedRecord(record, value, (await index.repairStamp?.(record, value)) ?? stamp);
    repairs.push({ before: record, after: repaired });
    final.set(id, repaired);
    await index.save([repaired]);
  }
  const result = [...final.values()];
  assertOrderedNumberLimits(result, records, repairs, !!operation);
  await index.validate?.(result, repairs);
  return result;
};
