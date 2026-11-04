import type { StorageLogEntry, StorageLogRead } from "pstdio-sync-contracts";
import { decodeLogCursor, encodeLogCursor, logBatchEnd, logPageLimit } from "./log-cursor";
import { type LogRemoteCandidate, materializeLogRemote, planLogRemote } from "./log-metadata-reader";
import type { openLogState } from "./log-state";
import type { createLogTransfers } from "./log-transfer";
import type { LogEntryMetadata, LogKnownEntry, LogReadPlan, LogSyncInput } from "./log-types";

interface Choice {
  entry: LogEntryMetadata;
  sequence: number | null;
  index: number;
  local: number;
  remote?: LogRemoteCandidate;
}
const compare = (a: Choice, b: Choice) => {
  if (a.sequence === null && b.sequence === null) return a.local - b.local;
  if (a.sequence === null) return 1;
  if (b.sequence === null) return -1;
  return a.sequence - b.sequence || a.index - b.index;
};
const consumed = (known: LogKnownEntry | undefined, cursor: ReturnType<typeof decodeLogCursor>) =>
  known &&
  ((known.local && known.localSequence <= cursor.local) ||
    (known.sequence !== null &&
      (known.sequence < cursor.relay || (known.sequence === cursor.relay && known.index! <= cursor.index))));

const addRemoteChoices = (
  candidates: Map<string, Choice>,
  rows: LogRemoteCandidate[],
  known: Map<string, LogKnownEntry>,
  cursor: ReturnType<typeof decodeLogCursor>,
  newest: boolean,
) => {
  for (const row of rows) {
    const saved = known.get(row.metadata.id);
    if (saved && saved.fingerprint !== row.metadata.fingerprint)
      throw new Error("Log entry identity reused with changed content");
    if (!newest && consumed(saved, cursor)) continue;
    const position =
      saved?.sequence !== null &&
      saved?.sequence !== undefined &&
      (saved.sequence < row.sequence || (saved.sequence === row.sequence && saved.index! < row.index))
        ? { sequence: saved.sequence, index: saved.index! }
        : row;
    const entry = {
      id: row.metadata.id,
      writerId: row.metadata.writerId,
      createdAt: row.metadata.createdAt,
      cursor: encodeLogCursor({ ...cursor, relay: position.sequence, index: position.index }),
    };
    const candidate = {
      entry,
      sequence: position.sequence,
      index: position.index,
      local: saved?.localSequence ?? 0,
      remote: row,
    };
    const previous = candidates.get(entry.id);
    if (!previous || previous.sequence === null || compare(candidate, previous) <= 0)
      candidates.set(entry.id, candidate);
    else previous.remote = row;
  }
};

/** Merge authenticated remote metadata with cached/optimistic column metadata before opening any body. */
export const planLogStream = async (
  input: LogSyncInput,
  transfers: ReturnType<typeof createLogTransfers>,
  first: Awaited<ReturnType<LogSyncInput["relay"]["read"]>>,
  state: Awaited<ReturnType<typeof openLogState>>,
  options: StorageLogRead = {},
): Promise<LogReadPlan> => {
  const { store } = input;
  if (!store.plan || !store.lookupMetadata) throw new Error("Log storage does not support metadata-only planning");
  const cursor = decodeLogCursor(store.address, options.after);
  const limit = logPageLimit(options.limit);
  const local = await store.plan(options);
  const remote = await planLogRemote(input, transfers, first, state, cursor, limit, !!options.newest);
  const identities = [
    ...new Set([...local.entries.map((entry) => entry.id), ...remote.rows.map((row) => row.metadata.id)]),
  ];
  const known = new Map((await store.lookupMetadata(identities)).map((row) => [row.id, row]));
  const candidates = new Map<string, Choice>();
  for (const entry of local.entries) {
    const saved = known.get(entry.id)!;
    if (saved.sequence === null && remote.more && !options.newest) continue;
    candidates.set(entry.id, { entry, sequence: saved.sequence, index: saved.index ?? 0, local: saved.localSequence });
  }
  addRemoteChoices(candidates, remote.rows, known, cursor, !!options.newest);
  const ordered = [...candidates.values()].sort(compare);
  const selected = options.newest ? ordered.slice(-limit) : ordered.slice(0, limit);
  const more = !options.newest && (remote.more || local.more || ordered.length > selected.length);
  let end = { ...cursor };
  const entries = selected.map((item) => {
    end = item.sequence === null ? { ...end, local: item.local } : { ...end, relay: item.sequence, index: item.index };
    if (item.sequence === null && !remote.more) end = { ...end, relay: remote.head, index: logBatchEnd };
    return { ...item.entry, cursor: encodeLogCursor(end) };
  });
  if (options.newest)
    end = {
      ...decodeLogCursor(store.address, remote.cursor),
      local: decodeLogCursor(store.address, local.cursor).local,
    };
  else if (!ordered.length) end = decodeLogCursor(store.address, remote.cursor);
  else if (!more) end = { ...end, relay: Math.max(end.relay, remote.head), index: logBatchEnd };
  const allowed = new Map(selected.map((item) => [item.entry.id, item]));
  const cached = new Set(local.entries.map((entry) => entry.id));
  return {
    entries,
    cursor: encodeLogCursor(end),
    more,
    async materialize(ids) {
      if (new Set(ids).size !== ids.length || ids.some((id) => !allowed.has(id)))
        throw new Error("Unplanned log payload identity");
      const values = new Map<string, StorageLogEntry>(
        (await local.materialize(ids.filter((id) => cached.has(id)))).map((entry) => [entry.id, entry]),
      );
      const received = await materializeLogRemote(
        input,
        transfers,
        remote,
        ids.flatMap((id) => (allowed.get(id)!.remote ? [allowed.get(id)!.remote!] : [])),
        values,
      );
      for (const [id, entry] of received) values.set(id, entry);
      return ids.flatMap((id) => (values.has(id) ? [values.get(id)!] : []));
    },
  };
};
