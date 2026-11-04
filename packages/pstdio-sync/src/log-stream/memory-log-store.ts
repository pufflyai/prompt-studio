import {
  canonicalJson,
  fingerprint,
  type Json,
  type StorageLogEntry,
  type StorageLogRead,
} from "pstdio-sync-contracts";
import type { LogDelivery, LogReceivedBatch, LogStreamStore } from "./log-types";
import { planMemoryLog } from "./memory-log-plan";

interface Row {
  entry: StorageLogEntry;
  fingerprint: string;
  local: boolean;
  localSequence: number;
  sequence: number | null;
  index: number;
  delivery?: LogDelivery;
}
const validatePosition = (sequence: number) => {
  if (!Number.isSafeInteger(sequence) || sequence <= 0) throw new Error("Invalid log relay position");
};
export const createMemoryLogStore = (input: {
  address: string;
  writerId: string;
  keep?: { days: number };
  now?: () => number;
  changed?: () => void;
}) => {
  let rows = new Map<string, Row>();
  let local = 0;
  let head = 0;
  let completeThrough = 0;
  let stateId: string | null = null;
  let through = 0;
  let writing: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  const changed = () => {
    input.changed?.();
    for (const listener of listeners) listener();
  };
  const cutoff = () => (input.keep ? (input.now ?? Date.now)() - input.keep.days * 86_400_000 : 0);
  const write = <T>(run: () => Promise<T>) => {
    const next = writing.then(run);
    writing = next.catch(() => {});
    return next;
  };
  const live = () => [...rows.values()].filter((row) => Date.parse(row.entry.createdAt) >= cutoff());
  const canonical = () =>
    live()
      .filter((row) => row.sequence !== null)
      .sort((a, b) => a.sequence! - b.sequence! || a.index - b.index);
  const receiveRow = async (next: Map<string, Row>, entry: StorageLogEntry, sequence: number, index: number) => {
    const identity = await fingerprint(entry as unknown as Json);
    const previous = next.get(entry.id);
    if (previous && previous.fingerprint !== identity) throw new Error("Log entry identity reused");
    if (!previous)
      next.set(entry.id, {
        entry,
        fingerprint: identity,
        local: false,
        localSequence: ++local,
        sequence: sequence,
        index,
      });
    else if (
      previous.sequence === null ||
      sequence < previous.sequence ||
      (sequence === previous.sequence && index < previous.index)
    ) {
      previous.sequence = sequence;
      previous.index = index;
      previous.delivery = undefined;
    }
  };
  const batchCovered = (next: Map<string, Row>, batch: LogReceivedBatch) => {
    if (batch.expected)
      return batch.expected.every((item) => {
        const row = next.get(item.id);
        if (row && row.fingerprint !== item.fingerprint) throw new Error("Log entry identity reused");
        return !!row && row.sequence !== null;
      });
    const count = [...next.values()].filter(
      (row) => row.sequence === batch.sequence && Date.parse(row.entry.createdAt) >= cutoff(),
    ).length;
    return count >= (batch.retainedCount ?? batch.entries.length);
  };
  const receiveBatches = async (next: Map<string, Row>, batches: LogReceivedBatch[], complete: number) => {
    for (const batch of batches) {
      if (batch.skipBefore !== undefined && batch.skipBefore === complete) complete = batch.sequence - 1;
      validatePosition(batch.sequence);
      for (const [index, entry] of batch.entries.entries())
        if (entry) await receiveRow(next, entry, batch.sequence, index);
      const covered = batchCovered(next, batch);
      if (batch.sequence === complete + 1 && covered) complete = batch.sequence;
    }

    return complete;
  };
  const store: LogStreamStore = {
    address: input.address,
    cutoff,
    append(value, options = {}) {
      const owned = structuredClone(value);
      const id = options.id ?? crypto.randomUUID();
      return write(async () => {
        const previous = rows.get(id);
        if (previous) {
          if (
            previous.entry.writerId !== input.writerId ||
            canonicalJson(previous.entry.value) !== canonicalJson(owned)
          )
            throw new Error("Log entry identity reused");
          return structuredClone(previous.entry);
        }
        const entry = {
          id,
          writerId: input.writerId,
          createdAt: new Date((input.now ?? Date.now)()).toISOString(),
          value: owned,
        };
        rows.set(id, {
          entry,
          fingerprint: await fingerprint(entry as unknown as Json),
          local: true,
          localSequence: ++local,
          sequence: null,
          index: 0,
        });
        changed();
        return structuredClone(entry);
      });
    },
    async plan(options: StorageLogRead = {}) {
      await writing;
      return planMemoryLog({ address: input.address, rows: live(), head, completeThrough, cutoff }, options);
    },
    async lookupMetadata(ids) {
      await writing;
      return ids.flatMap((id) => {
        const row = rows.get(id);
        return row
          ? [
              {
                id,
                writerId: row.entry.writerId,
                createdAt: row.entry.createdAt,
                sequence: row.sequence,
                index: row.index,
                localSequence: row.localSequence,
                local: row.local,
              },
            ]
          : [];
      });
    },
    async read(options: StorageLogRead = {}) {
      const page = await store.plan!(options);
      return {
        entries: await page.materialize(page.entries.map((entry) => entry.id)),
        cursor: page.cursor,
        more: page.more,
      };
    },
    async pendingThrough() {
      await writing;
      return local;
    },
    async pending(limit, through = Number.MAX_SAFE_INTEGER) {
      await writing;
      return live()
        .filter((row) => row.local && row.sequence === null && row.localSequence <= through)
        .sort((a, b) => a.localSequence - b.localSequence)
        .slice(0, limit)
        .map((row) => ({ entry: structuredClone(row.entry), delivery: structuredClone(row.delivery) }));
    },
    prepare(id, delivery) {
      const owned = structuredClone(delivery);
      return write(async () => {
        const row = rows.get(id);
        if (!row?.local) throw new Error("Only authored appends can be delivered");
        row.delivery ??= owned;
        return structuredClone(row.delivery);
      });
    },
    receive(batches, nextHead, options = {}) {
      const owned = structuredClone({ batches, nextHead, options });
      return write(async () => {
        const next = new Map([...rows].map(([id, row]) => [id, structuredClone(row)]));
        let complete =
          (owned.options.from ?? completeThrough) === completeThrough
            ? Math.max(completeThrough, owned.options.skipTo ?? completeThrough)
            : -1;
        complete = await receiveBatches(next, owned.batches, complete);
        rows = next;
        head = Math.max(head, owned.nextHead);
        completeThrough = Math.max(completeThrough, complete);
        if (owned.options.stateId !== undefined) {
          stateId = owned.options.stateId;
          through = owned.options.through ?? 0;
        }
        if (owned.batches.some((batch) => batch.entries.some(Boolean))) changed();
      });
    },
    async status() {
      await writing;
      return { head, completeThrough, stateId, through };
    },
    async snapshotPage(after, limit) {
      await writing;
      return canonical()
        .filter((row) => row.sequence! > after.sequence || (row.sequence === after.sequence && row.index > after.index))
        .slice(0, limit)
        .map((row) => ({ sequence: row.sequence!, index: row.index, entry: structuredClone(row.entry) }));
    },
    watch(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    store,
    dump: async () => {
      await writing;
      return live().map((row) => structuredClone(row));
    },
  };
};
