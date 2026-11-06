import type { StorageLogEntry, StoredUpdate } from "pstdio-sync-contracts";
import { type decodeLogCursor, encodeLogCursor, logBatchEnd } from "./log-cursor";
import { createLogPageIndex, type LogIndexedMetadata } from "./log-page-index";
import { readLogRelayPage } from "./log-relay-page";
import type { openLogState } from "./log-state";
import type { createLogTransfers } from "./log-transfer";
import type { LogSyncInput } from "./log-types";
import { type LogWireEntry, readLogPayload } from "./log-wire";

export interface LogRemoteCandidate {
  sequence: number;
  index: number;
  metadata: Omit<LogWireEntry, "reference">;
  archive?: LogIndexedMetadata;
  wire?: { update: StoredUpdate; entries: LogWireEntry[] };
}
type Transfers = ReturnType<typeof createLogTransfers>;
const wireGroups = (selected: LogRemoteCandidate[], cutoff: number) => {
  const wires = new Map<string, { update: StoredUpdate; entries: LogWireEntry[]; chosen: Set<number> }>();
  for (const row of selected) {
    if (!row.wire || Date.parse(row.metadata.createdAt) < cutoff) continue;
    const group = wires.get(row.wire.update.updateId) ?? { ...row.wire, chosen: new Set<number>() };
    group.chosen.add(row.index);
    wires.set(group.update.updateId, group);
  }
  return wires.values();
};

export const planLogRemote = async (
  input: LogSyncInput,
  transfers: Transfers,
  first: Awaited<ReturnType<LogSyncInput["relay"]["read"]>>,
  state: Awaited<ReturnType<typeof openLogState>>,
  cursor: ReturnType<typeof decodeLogCursor>,
  limit: number,
  newest: boolean,
) => {
  const rows: LogRemoteCandidate[] = [];
  const floor = first.state?.through ?? 0;
  const head = state.offset + first.lastSequence;
  let more = false;
  const readWindow = async (after: number, through: number, ceiling: number) => {
    while (true) {
      const page = await readLogRelayPage(input.relay, after);
      if (page.status !== "updates") throw new Error("Log tail was compacted during metadata planning");
      for (const update of page.updates.filter((item) => item.sequence <= through)) {
        const entries = await transfers.wireUpdate(update);
        rows.push(
          ...transfers
            .retained(entries)
            .filter(
              (entry) =>
                newest ||
                state.offset + update.sequence > cursor.relay ||
                (state.offset + update.sequence === cursor.relay && entry.index > cursor.index),
            )
            .map((entry) => ({
              sequence: state.offset + update.sequence,
              index: entry.index,
              metadata: entry,
              wire: { update, entries },
            })),
        );
        after = update.sequence;
        if (rows.length >= ceiling) return true;
      }
      if (!page.more || after >= through || !page.updates.length) return false;
    }
  };
  const archive = async (count: number) => {
    if (!first.state || !count) return false;
    const { nodes } = await transfers.connect();
    const page = await createLogPageIndex(nodes).plan(state.root, {
      sequence: cursor.relay,
      index: cursor.index,
      limit: count,
      newest,
      cutoff: input.store.cutoff(),
    });
    rows.push(
      ...page.rows.map((row) => ({ sequence: row.sequence, index: row.index, metadata: row.metadata, archive: row })),
    );
    return page.more;
  };
  if (newest) {
    let start = first.lastSequence;
    let width = 1;
    while (start > floor && rows.length < limit) {
      const after = Math.max(floor, start - width);
      await readWindow(after, start, Number.MAX_SAFE_INTEGER);
      start = after;
      width *= 2;
    }
    rows.sort((a, b) => b.sequence - a.sequence || b.index - a.index);
    rows.splice(limit);
    await archive(limit - rows.length);
    rows.sort((a, b) => a.sequence - b.sequence || a.index - b.index);
  } else {
    if (cursor.relay <= state.offset + floor) more = await archive(limit + 1);
    if (!more && rows.length <= limit)
      more = await readWindow(
        Math.max(floor, cursor.relay - state.offset - (cursor.index < logBatchEnd ? 1 : 0)),
        first.lastSequence,
        limit + 1,
      );
    more ||= rows.length > limit;
    rows.splice(limit);
  }
  const last = rows.at(-1);
  const end =
    newest || !more
      ? { ...cursor, relay: head, index: logBatchEnd }
      : { ...cursor, relay: last?.sequence ?? cursor.relay, index: last?.index ?? cursor.index };
  return { rows, head, stateInfo: first.state, offset: state.offset, cursor: encodeLogCursor(end), more };
};

/** Cache coordinates only for chosen payloads; a sparse page never claims an unseen retained prefix. */
export const materializeLogRemote = async (
  input: LogSyncInput,
  transfers: Transfers,
  plan: Awaited<ReturnType<typeof planLogRemote>>,
  selected: LogRemoteCandidate[],
  cached: ReadonlyMap<string, StorageLogEntry>,
) => {
  const values = new Map<string, StorageLogEntry>();
  const archived = selected.filter((row) => row.archive && Date.parse(row.metadata.createdAt) >= input.store.cutoff());
  if (archived.length && plan.stateInfo) {
    const { nodes } = await transfers.connect();
    const index = createLogPageIndex(nodes);
    const missing = archived.filter((row) => !cached.has(row.metadata.id));
    const downloaded = await index.materialize(
      missing.map((row) => row.archive!),
      input.store.cutoff,
    );
    for (const row of downloaded) values.set(row.entry.id, row.entry);
    for (const row of archived)
      if (cached.has(row.metadata.id) && Date.parse(row.metadata.createdAt) >= input.store.cutoff())
        values.set(
          row.metadata.id,
          await readLogPayload(cached.get(row.metadata.id), { ...row.metadata, reference: row.archive!.reference }),
        );
    await transfers.receiveIndex(
      archived
        .filter((row) => values.has(row.metadata.id))
        .map((row) => ({ sequence: row.sequence, index: row.index, entry: values.get(row.metadata.id)! })),
      plan.head,
      plan.stateInfo,
    );
  }
  for (const group of wireGroups(selected, input.store.cutoff())) {
    const missing = new Set([...group.chosen].filter((index) => !cached.has(group.entries[index]!.id)));
    const entries = await transfers.materialize(group.entries, missing);
    for (const index of group.chosen) {
      const metadata = group.entries[index]!;
      if (Date.parse(metadata.createdAt) < input.store.cutoff()) continue;
      entries[index] ??= await readLogPayload(cached.get(metadata.id), metadata);
      values.set(metadata.id, entries[index]!);
    }
    await input.store.receive(
      [
        {
          sequence: plan.offset + group.update.sequence,
          entries,
          expected: transfers
            .retained(group.entries)
            .map((entry) => ({ id: entry.id, fingerprint: entry.fingerprint })),
        },
      ],
      plan.head,
      { from: -1 },
    );
  }
  return values;
};
