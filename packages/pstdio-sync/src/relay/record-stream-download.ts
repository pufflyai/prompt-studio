import type { ReadResult, StateInfo, StoredUpdate } from "pstdio-sync-contracts";
import type { DocumentRelay } from "./document-sync-types";
import type { RecordFrame } from "./record-frames";
import type { createRecordStreamReader } from "./record-stream-reader";

const addFrames = (remote: Map<string, Uint8Array[]>, frames: (RecordFrame | null)[]) => {
  for (const record of frames.flatMap((frame) => frame?.records ?? []))
    remote.set(record.recordId, [...(remote.get(record.recordId) ?? []), record.bytes]);
  return remote;
};

export const checkRecordStreamPage = (result: Extract<ReadResult, { status: "updates" }>, after: number) => {
  let expected = after;
  for (const update of result.updates) {
    if (update.sequence <= expected) continue;
    if (update.sequence !== expected + 1) throw new Error("Relay update sequence has a gap");
    expected = update.sequence;
  }
  if (!result.more && expected < result.lastSequence) throw new Error("Relay did not return every update");
  return result.updates.filter((update) => update.sequence > after);
};
const pageReader = (relay: DocumentRelay, initial?: ReadResult) => {
  let page = initial;
  return (after: number) => {
    const current = page;
    page = undefined;
    return current ?? relay.read(after);
  };
};

/** Collects the latest state and every retained update for adoption or repair. Null when unreadable. */
export const createRecordStreamDownload =
  (reader: ReturnType<typeof createRecordStreamReader>, relay: DocumentRelay) =>
  async (
    initial: { remote: Map<string, Uint8Array[]>; after: number; state: StateInfo | null } = {
      remote: new Map(),
      after: 0,
      state: null,
    },
    first?: ReadResult,
  ) => {
    let { remote, after, state } = initial;
    let snapshot = new Map(remote);
    let tail: (RecordFrame | null)[] = [];
    let tailUpdates: StoredUpdate[] = [];
    let skipped = false;
    let pendingBytes = 0;
    const read = pageReader(relay, first);
    while (true) {
      const result = await read(after);
      if (result.state && result.state.stateId !== state?.stateId) {
        state = result.state;
        const frames = await reader.openLatest(state);
        // Adopting without the stream's records would upload unrelated histories; wait instead.
        if (!frames) return null;
        remote = addFrames(new Map(), frames);
        snapshot = new Map(remote);
        tail = [];
        tailUpdates = [];
        after = state.through;
        // A newer latest state covers every update skipped before it.
        skipped = false;
        pendingBytes = 0;
        continue;
      }
      if (result.status === "state-required") throw new Error("Relay is missing updates after its latest state");
      const updates = checkRecordStreamPage(result, after);
      const { frames, byteLengths } = await reader.openFrames(updates);
      pendingBytes += byteLengths.reduce((sum, bytes) => sum + bytes, 0);
      if (frames.includes(null)) skipped = true;
      addFrames(remote, frames);
      tail.push(...frames);
      tailUpdates.push(...updates);
      after = updates.at(-1)?.sequence ?? after;
      if (!result.more)
        return { remote, snapshot, frames: tail, updates: tailUpdates, after, state, skipped, pendingBytes };
    }
  };
