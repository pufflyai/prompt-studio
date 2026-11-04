import type { StorageLogEntry, StorageLogRead } from "pstdio-sync-contracts";
import { decodeLogCursor, encodeLogCursor, logBatchEnd, logPageLimit } from "./log-cursor";
import type { LogReadPlan } from "./log-types";

interface Row {
  entry: StorageLogEntry;
  local: boolean;
  localSequence: number;
  sequence: number | null;
  index: number;
}
export const planMemoryLog = (
  input: { address: string; rows: Row[]; head: number; completeThrough: number; cutoff(): number },
  options: StorageLogRead = {},
): LogReadPlan => {
  const cursor = decodeLogCursor(input.address, options.after);
  const limit = logPageLimit(options.limit);
  const pending = input.rows
    .filter((row) => row.local && row.sequence === null && (options.newest || row.localSequence > cursor.local))
    .sort((a, b) => a.localSequence - b.localSequence);
  const canonical = input.rows
    .filter(
      (row) =>
        row.sequence !== null &&
        (options.newest ||
          row.sequence > cursor.relay ||
          (row.sequence === cursor.relay && row.index > cursor.index)) &&
        (options.newest || !row.local || row.localSequence > cursor.local),
    )
    .sort((a, b) => a.sequence! - b.sequence! || a.index - b.index);
  const all = [...canonical, ...pending];
  const selected = options.newest ? all.slice(-limit) : all.slice(0, limit);
  const next = { ...cursor };
  const entries = selected.map((row) => {
    if (row.sequence !== null) {
      next.relay = row.sequence;
      next.index = row.index;
    } else next.local = row.localSequence;
    return {
      id: row.entry.id,
      writerId: row.entry.writerId,
      createdAt: row.entry.createdAt,
      cursor: encodeLogCursor(next),
    };
  });
  const more = !options.newest && all.length > limit;
  if (!more && (options.newest || input.completeThrough >= input.head)) {
    next.relay = input.head;
    next.index = logBatchEnd;
  }
  const allowed = new Map(selected.map((row) => [row.entry.id, row.entry]));
  return {
    entries,
    cursor: encodeLogCursor(next),
    more,
    async materialize(ids) {
      if (new Set(ids).size !== ids.length || ids.some((id) => !allowed.has(id)))
        throw new Error("Unplanned log payload identity");
      return ids.flatMap((id) => {
        const entry = allowed.get(id)!;
        return Date.parse(entry.createdAt) >= input.cutoff() ? [structuredClone(entry)] : [];
      });
    },
  };
};
