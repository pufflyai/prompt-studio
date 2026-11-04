import type { StateInfo, StorageLogRead, StoredUpdate } from "pstdio-sync-contracts";
import type { DocumentRelay } from "../relay";
import { decodeLogCursor, logBatchEnd } from "./log-cursor";
import { createLogPageIndex } from "./log-page-index";
import { readLogRelayPage } from "./log-relay-page";
import type { openLogState } from "./log-state";
import type { createLogTransfers } from "./log-transfer";
import type { LogSyncInput } from "./log-types";
import type { LogWireEntry } from "./log-wire";

const readArchive = async (
  input: LogSyncInput,
  transfers: ReturnType<typeof createLogTransfers>,
  options: {
    stateInfo: StateInfo;
    state: Awaited<ReturnType<typeof openLogState>>;
    head: number;
    cursor: ReturnType<typeof decodeLogCursor>;
    limit: number;
  },
) => {
  const { store } = input;
  const { connect, receiveIndex } = transfers;
  const { nodes } = await connect();
  const index = createLogPageIndex(nodes);
  const page = await index.read(options.state.root, {
    sequence: options.cursor.relay,
    index: options.cursor.index,
    limit: options.limit,
    cutoff: store.cutoff(),
  });
  const status = await store.status();
  const from = options.cursor.relay === status.completeThrough ? options.cursor.relay : options.cursor.relay - 1;
  const skip = options.cursor.relay === status.completeThrough;
  const counts = new Map<number, number>();
  for (const sequence of new Set(page.rows.map((row) => row.sequence)))
    counts.set(sequence, await index.count(options.state.root!, sequence, store.cutoff()));
  await receiveIndex(page.rows, options.state.offset + options.head, options.stateInfo, { from, skip, counts });
  if (!page.more && (page.rows.length || skip))
    await store.receive([], options.state.offset + options.head, {
      from: page.rows.at(-1)?.sequence ?? from,
      skipTo: options.state.offset + options.stateInfo.through,
    });

  return page;
};
export const createLogReader = (input: LogSyncInput, transfers: ReturnType<typeof createLogTransfers>) => {
  const { relay, store } = input;
  const { connect, wireUpdate, retained, receiveWire, receiveIndex } = transfers;
  const readWindow = async (after: number, through: number) => {
    const selected: { update: StoredUpdate; metadata: LogWireEntry[]; index: number }[] = [];
    let page = await readLogRelayPage(relay, after);
    while (true) {
      if (page.status !== "updates") throw new Error("Log tail was compacted during its read");
      for (const update of page.updates.filter((update) => update.sequence <= through)) {
        const metadata = await wireUpdate(update);
        selected.push(...retained(metadata).map((entry) => ({ update, metadata, index: entry.index })));
      }
      const last = page.updates.at(-1)?.sequence ?? after;
      if (!page.more || last >= through) return selected;
      page = await readLogRelayPage(relay, last);
    }
  };
  const readNewest = async (
    first: Awaited<ReturnType<DocumentRelay["read"]>>,
    state: Awaited<ReturnType<typeof openLogState>>,
    limit: number,
  ) => {
    const selected: { update: StoredUpdate; metadata: LogWireEntry[]; index: number }[] = [];
    let width = 1;
    let start = first.lastSequence;
    const floor = first.state?.through ?? 0;
    while (start > floor && selected.length < limit) {
      const after = Math.max(floor, start - width);
      selected.push(...(await readWindow(after, start)));
      start = after;
      width *= 2;
    }
    selected.sort((a, b) => b.update.sequence - a.update.sequence || b.index - a.index);
    const chosen = selected.slice(0, limit);
    const byUpdate = new Map<string, { update: StoredUpdate; metadata: LogWireEntry[]; indices: Set<number> }>();
    for (const item of chosen) {
      const entry = byUpdate.get(item.update.updateId) ?? {
        update: item.update,
        metadata: item.metadata,
        indices: new Set<number>(),
      };
      entry.indices.add(item.index);
      byUpdate.set(item.update.updateId, entry);
    }
    for (const item of byUpdate.values()) await receiveWire(item.update, state.offset, item.metadata, item.indices, -1);
    if (chosen.length < limit && first.state) {
      const { nodes } = await connect();
      const page = await createLogPageIndex(nodes).read(state.root, {
        sequence: 0,
        index: 0,
        limit: limit - chosen.length,
        newest: true,
        cutoff: store.cutoff(),
      });
      await receiveIndex(page.rows, state.offset + first.lastSequence, first.state);
    }
  };
  const readTail = async (
    after: number,
    cursor: ReturnType<typeof decodeLogCursor>,
    offset: number,
    remaining: number,
  ) => {
    while (remaining > 0) {
      const result = await readLogRelayPage(relay, after);
      if (result.status !== "updates") throw new Error("Log tail was compacted during its read");
      for (const update of result.updates) {
        const metadata = await wireUpdate(update);
        const eligible = retained(metadata).filter(
          (entry) => offset + update.sequence > cursor.relay || entry.index > cursor.index,
        );
        const indices = new Set(eligible.slice(0, remaining).map((entry) => entry.index));
        await receiveWire(update, offset, metadata, indices, offset + after);
        remaining -= indices.size;
        after = update.sequence;
        if (!remaining) return eligible.length > indices.size || result.more || result.updates.at(-1)!.sequence > after;
      }
      if (!result.more || !result.updates.length) break;
    }
    return false;
  };
  const readAfter = async (
    first: Awaited<ReturnType<DocumentRelay["read"]>>,
    state: Awaited<ReturnType<typeof openLogState>>,
    options: StorageLogRead,
    limit: number,
  ) => {
    const cursor = decodeLogCursor(store.address, options.after);
    let remaining = limit;
    if (first.state && cursor.relay <= state.offset + first.state.through) {
      const page = await readArchive(input, transfers, {
        stateInfo: first.state,
        state,
        head: first.lastSequence,
        cursor,
        limit,
      });
      remaining -= page.rows.length;
      if (page.more || !remaining) return page.more || first.lastSequence > first.state.through;
    }
    return readTail(
      Math.max(first.state?.through ?? 0, cursor.relay - state.offset - (cursor.index < logBatchEnd ? 1 : 0)),
      cursor,
      state.offset,
      remaining,
    );
  };

  return { readNewest, readAfter };
};
