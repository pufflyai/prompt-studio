import { fingerprint, type Json, type StateInfo, type StoredUpdate } from "pstdio-sync-contracts";
import { openUpdate, sealUpdate } from "../encryption";
import { createEncryptedManifestNodes, type OrderedIndexBlobs } from "../relay";
import { encodeBytes } from "../shared";
import type { LogIndexedEntry } from "./log-page-index";
import type { LogDelivery, LogReceivedBatch, LogStreamStore, LogSyncInput } from "./log-types";
import { decodeLogWire, encodeLogWire, type LogWireEntry, readLogPayload } from "./log-wire";

const cachePage = <T>(blobs: OrderedIndexBlobs, run: () => Promise<T>) => blobs.batch?.(run) ?? run();
const finishPage = async <T>(work: Promise<T>[]) => {
  // Drain every page operation before a failed transaction releases its connection.
  const results = await Promise.allSettled(work);
  return results.map((result) => {
    if (result.status === "rejected") throw result.reason;
    return result.value;
  });
};
export const createLogTransfers = (input: LogSyncInput) => {
  const { space, documentId, relay, store } = input;
  let connection:
    | Promise<{ blobs: OrderedIndexBlobs; nodes: ReturnType<typeof createEncryptedManifestNodes> }>
    | undefined;
  const connect = () =>
    (connection ??= (async () => {
      const provider = input.manifestBlobs ?? relay.manifestBlobs;
      if (!provider) throw new Error("Relay does not support log manifest references");
      const blobs = await provider();
      return { blobs, nodes: createEncryptedManifestNodes(space, blobs) };
    })());
  const wireUpdate = async (update: Pick<StoredUpdate, "updateId" | "payload">) =>
    decodeLogWire(await openUpdate(space, documentId, update));
  const prepare = async (pending: Awaited<ReturnType<LogStreamStore["pending"]>>) => {
    if (pending[0]!.delivery) return pending[0]!.delivery;
    const { blobs } = await connect();
    const saved: LogDelivery["blobs"] = [];
    const nodes = createEncryptedManifestNodes(space, {
      ...blobs,
      put: async (id, bytes, children) => {
        saved.push({ blobId: id, bytes: encodeBytes(bytes), children });
        await blobs.put(id, bytes, children);
      },
    });
    const selected: typeof pending = [];
    let bytes = 0;
    for (const item of pending) {
      const size = new TextEncoder().encode(JSON.stringify(item.entry)).length;
      if (selected.length && bytes + size > 4 * 1024 * 1024) break;
      bytes += size;
      selected.push(item);
    }
    const entries = await cachePage(blobs, () =>
      finishPage(
        selected.map(async (item) => {
          const reference = await nodes.write(item.entry as unknown as Json, []);
          return {
            id: item.entry.id,
            writerId: item.entry.writerId,
            createdAt: item.entry.createdAt,
            fingerprint: await fingerprint(item.entry as unknown as Json),
            reference,
          };
        }),
      ),
    );
    const envelope = await sealUpdate(
      space,
      documentId,
      encodeLogWire(entries),
      entries.map((entry) => entry.reference.blobId),
    );
    return store.prepare(pending[0]!.entry.id, { envelope, blobs: saved });
  };
  const materialize = async (metadata: LogWireEntry[], selected: Set<number>) => {
    const { blobs, nodes } = await connect();
    return cachePage(blobs, () =>
      finishPage(
        metadata.map(async (entry, index) => {
          if (!selected.has(index) || Date.parse(entry.createdAt) < store.cutoff()) return null;
          const payload = await readLogPayload(await nodes.read(entry.reference), entry);
          await nodes.retain(entry.reference, []);
          return payload;
        }),
      ),
    );
  };
  const retained = (metadata: LogWireEntry[]) =>
    metadata.flatMap((entry, index) => (Date.parse(entry.createdAt) >= store.cutoff() ? [{ ...entry, index }] : []));
  const receiveWire = async (
    update: StoredUpdate,
    offset: number,
    metadata: LogWireEntry[],
    selected: Set<number>,
    from: number,
  ) => {
    const eligible = retained(metadata);
    await store.receive(
      [
        {
          sequence: offset + update.sequence,
          entries: await materialize(metadata, selected),
          expected: eligible.map((entry) => ({ id: entry.id, fingerprint: entry.fingerprint })),
        },
      ],
      offset + update.sequence,
      { from },
    );
  };
  const receiveIndex = async (
    rows: LogIndexedEntry[],
    head: number,
    state: StateInfo,
    options: { from?: number; counts?: Map<number, number>; skip?: boolean } = {},
  ) => {
    const grouped = new Map<number, LogReceivedBatch>();
    for (const row of rows) {
      let batch = grouped.get(row.sequence);
      if (!batch) {
        batch = { sequence: row.sequence, entries: [] };
        grouped.set(row.sequence, batch);
      }
      while (batch.entries.length <= row.index) batch.entries.push(null);
      batch.entries[row.index] = row.entry;
    }
    let previous = options.skip ? options.from : undefined;
    for (const batch of grouped.values()) {
      batch.retainedCount = options.counts?.get(batch.sequence);
      batch.skipBefore = previous;
      previous = batch.sequence;
    }
    await store.receive([...grouped.values()], head, {
      from: options.from ?? -1,
      stateId: state.stateId,
      through: state.through,
    });
  };

  return { connect, wireUpdate, prepare, materialize, retained, receiveWire, receiveIndex };
};
