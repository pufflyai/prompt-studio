import type { ReadResult, StateInfo, StoredUpdate } from "pstdio-sync-contracts";
import { decodeBytes } from "../encoding";
import { sealBlob, sealState, sealUpdate } from "../encryption";
import { latestStateLimits } from "./document-sync";
import { createRecordAssets } from "./record-assets";
import { encodeRecordFrame, type RecordFrame, recordFrameCost } from "./record-frames";
import { createRecordStreamReader } from "./record-stream-reader";
import type { RecordBytes, RecordStreamCursor, RecordStreamInput } from "./record-stream-types";

// Room for the frame header and encryption under the relay's 1 MiB update limit.
export const recordFrameLimit = 768 * 1024;
const chunkLimit = 4 * 1024 * 1024;

const splitRecords = (records: RecordBytes[], limit: number) => {
  const chunks: RecordBytes[][] = [];
  let size = 0;
  for (const record of records) {
    const cost = recordFrameCost(record.recordId, record.bytes);
    if (!chunks.length || size + cost > limit) {
      chunks.push([]);
      size = 0;
    }
    chunks.at(-1)!.push(record);
    size += cost;
  }
  return chunks;
};

const addFrames = (remote: Map<string, Uint8Array[]>, frames: (RecordFrame | null)[]) => {
  for (const record of frames.flatMap((frame) => frame?.records ?? []))
    remote.set(record.recordId, [...(remote.get(record.recordId) ?? []), record.bytes]);
  return remote;
};

const checkPage = (result: Extract<ReadResult, { status: "updates" }>, after: number) => {
  let expected = after;
  for (const update of result.updates) {
    if (update.sequence <= expected) continue;
    if (update.sequence !== expected + 1) throw new Error("Relay update sequence has a gap");
    expected = update.sequence;
  }
  if (!result.more && expected < result.lastSequence) throw new Error("Relay did not return every update");
  return result.updates.filter((update) => update.sequence > after);
};

/**
 * Syncs every record of one owner through one encrypted relay document (ADR 0102). Each relay
 * update is one local save. The first latest state founds the stream; later ones only compact
 * updates the relay already holds, so a device that follows the updates never needs them.
 */
export const createRecordStreamSync = (input: RecordStreamInput) => {
  const { space, documentId, relay, store } = input;
  const limits = input.limits ?? latestStateLimits;
  const files = createRecordAssets({ space, assets: input.assets, blobs: relay.blobs, references: store.references });
  let incomplete = false;
  let downloaded = false;
  const rejected = new Set<string>();
  const quarantine = async (failure: Parameters<RecordStreamInput["quarantine"]>[0]) => {
    incomplete = true;
    if (rejected.has(failure.id)) return;
    await input.quarantine(failure);
    rejected.add(failure.id);
  };
  const reader = createRecordStreamReader({ space, documentId, relay, files, quarantine });
  const latest = async (state: StateInfo) => addFrames(new Map(), (await reader.openLatest(state)) ?? []);
  const skippedRecords = async (recordIds: string[]) => {
    for (const recordId of recordIds)
      await quarantine({ kind: "update", id: `record:${recordId}`, envelope: { recordId } });
  };

  const withState = async (cursor: RecordStreamCursor, state: StateInfo | null) =>
    state && state.stateId !== cursor.stateId
      ? {
          ...cursor,
          stateId: state.stateId,
          through: state.through,
          pendingBytes: 0,
          stateBytes: (await reader.summary(state)).bytes,
        }
      : cursor;
  const updateBytes = (cursor: RecordStreamCursor, updates: StoredUpdate[]) =>
    updates
      .filter((update) => update.sequence > cursor.through)
      .reduce((sum, update) => sum + decodeBytes(update.payload).length, 0);

  /** Merges a latest state this device must load: a founding state, or one that replaced removed updates. */
  const load = async (cursor: RecordStreamCursor, state: StateInfo) => {
    const next = { ...(await withState(cursor, state)), after: state.through };
    await skippedRecords(await store.merge(await latest(state), "repair", next));
    return next;
  };
  // A founding state can hold records that no update carries; every device loads it once.
  const founding = (cursor: RecordStreamCursor, state: StateInfo | null) =>
    !!state && state.baseStateId === null && state.stateId !== cursor.stateId;

  const applyPage = async (cursor: RecordStreamCursor, result: Extract<ReadResult, { status: "updates" }>) => {
    const updates = checkPage(result, cursor.after);
    const next = await withState(cursor, result.state);
    if (!updates.length && next === cursor) return cursor;
    const frames = await reader.openFrames(updates);
    const applied = {
      ...next,
      after: updates.at(-1)?.sequence ?? cursor.after,
      pendingBytes: next.pendingBytes + updateBytes(next, updates),
    };
    for (const index of await store.apply(frames, applied))
      await quarantine({ kind: "update", id: updates[index]!.updateId, envelope: updates[index] });
    return applied;
  };

  /** Applies everything the relay holds after the cursor, a page per transaction. Null when the relay lost the stream. */
  const read = async (start: RecordStreamCursor): Promise<RecordStreamCursor | null> => {
    let cursor = start;
    while (true) {
      const result = await relay.read(cursor.after);
      if (!result.state && result.lastSequence === 0 && cursor.stateId) return null;
      if (result.status === "state-required" && !result.state) return null;
      if (result.status === "state-required" || founding(cursor, result.state)) {
        cursor = await load(cursor, result.state!);
        continue;
      }
      cursor = await applyPage(cursor, result);
      if (!result.more) return cursor;
    }
  };

  /**
   * Uploads every record as a latest state. A founding state starts or restarts the stream; a
   * compaction state needs every local save on the relay first. Null when it was not replaced.
   */
  const publish = async (cursor: RecordStreamCursor, found: boolean) => {
    const snapshot = await store.snapshot();
    if (!found && snapshot.outbox) return null;
    const chunks = [];
    const assetBlobs = new Set<string>();
    for (const records of splitRecords(snapshot.records, chunkLimit)) {
      // A compaction only lists files that earlier updates already uploaded.
      const assets = await files.upload(await store.assets(records.map((record) => record.recordId)), !found);
      for (const reference of assets) assetBlobs.add(reference.blobId);
      const sealed = await sealBlob(space, encodeRecordFrame({ records, assets }));
      await relay.blobs!.put(sealed.blobId, sealed.bytes);
      chunks.push({ blobId: sealed.blobId, byteLength: sealed.bytes.length });
    }
    const encoder = new TextEncoder();
    const through = found ? 0 : cursor.after;
    const bytes = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const state = await sealState(space, documentId, {
      baseStateId: found ? null : cursor.stateId,
      through,
      state: encoder.encode(JSON.stringify({ version: 1, chunks })),
      summary: encoder.encode(JSON.stringify({ records: snapshot.records.length, bytes })),
      blobIds: [...chunks.map((chunk) => chunk.blobId), ...assetBlobs],
    });
    if (!(await relay.replace(state))) return null;
    const next = { joined: true, stateId: state.stateId, after: through, through, pendingBytes: 0, stateBytes: bytes };
    // Every device loads a founding state, so the saves it includes need no separate upload.
    await store.published(next, found ? snapshot.outbox : 0);
    return next;
  };

  /** Sends the oldest saved local changes as one update. False when nothing was waiting. */
  const push = async () => {
    const entries = await store.outbox(recordFrameLimit);
    if (!entries.length) return false;
    const records = entries.flatMap((entry) => entry.records);
    const assets = await files.upload(entries.flatMap((entry) => entry.assets));
    let frame = encodeRecordFrame({ records, assets });
    const blobIds = assets.map((reference) => reference.blobId);
    // One save larger than an update travels as a blob, so it still arrives as one unit (R4).
    if (frame.length > recordFrameLimit) {
      const sealed = await sealBlob(space, frame);
      await relay.blobs!.put(sealed.blobId, sealed.bytes);
      const pointer = { blobId: sealed.blobId, byteLength: sealed.bytes.length };
      frame = encodeRecordFrame({ records: [], assets, blob: pointer });
      blobIds.push(sealed.blobId);
    }
    await relay.update(await sealUpdate(space, documentId, frame, blobIds));
    await store.sent(entries.at(-1)!.sequence);
    return true;
  };

  /** Collects every record the relay holds, for a device that has not joined yet. Null when its latest state is unreadable. */
  const download = async () => {
    let remote = new Map<string, Uint8Array[]>();
    let after = 0;
    let state: StateInfo | null = null;
    while (true) {
      const result = await relay.read(after);
      if (result.state && result.state.stateId !== state?.stateId) {
        state = result.state;
        const frames = await reader.openLatest(state);
        // Adopting without the stream's records would upload unrelated histories; wait instead.
        if (!frames) return null;
        remote = addFrames(new Map(), frames);
        after = state.through;
        continue;
      }
      if (result.status === "state-required") throw new Error("Relay is missing updates after its latest state");
      const updates = checkPage(result, after);
      addFrames(remote, await reader.openFrames(updates));
      after = updates.at(-1)?.sequence ?? after;
      if (!result.more) return { remote, after, state };
    }
  };

  /**
   * A device's first sync: the first device with records founds the stream, later ones adopt it.
   * Null while the stream does not exist and this device has nothing to found it with.
   */
  const join = async (cursor: RecordStreamCursor) => {
    const first = await relay.read(0);
    if (!first.state && first.lastSequence === 0) {
      if (!(await store.hasRecords())) return null;
      const founded = await publish(cursor, true);
      if (founded) return founded;
    }
    const downloaded = await download();
    if (!downloaded) return null;
    const { remote, after, state } = downloaded;
    const joined = { ...(await withState(cursor, state)), joined: true, after, pendingBytes: 0 };
    await skippedRecords(await store.merge(remote, "adopt", joined));
    return joined;
  };

  // Updates after the latest state outgrew it; a device that has them all replaces it (R18, R23).
  // Small owners also replace a long tail, so a new device does not replay thousands of updates.
  const due = (cursor: RecordStreamCursor) =>
    !incomplete &&
    cursor.after > cursor.through &&
    (cursor.pendingBytes > Math.max(limits.bytes, cursor.stateBytes) ||
      (cursor.after - cursor.through > limits.updates && cursor.stateBytes <= limits.bytes));

  /** One pass after reading: restart a lost stream, send saved changes, then compact. Null when done. */
  const send = async (cursor: RecordStreamCursor | null, previous: RecordStreamCursor) => {
    // The relay lost this stream. Any device with a full copy uploads it again (R3).
    if (!cursor) return (await publish(previous, true)) ?? previous;
    if (await push()) return cursor;
    if (!due(cursor)) return null;
    return publish(cursor, false);
  };

  return {
    async synchronize() {
      let cursor: RecordStreamCursor | null = await store.open();
      if (!cursor.joined) cursor = await join(cursor);
      while (cursor) {
        const next: RecordStreamCursor | null = await send(await read(cursor), cursor);
        if (!next) break;
        cursor = next;
      }
      downloaded = !incomplete;
    },
    status: async () => ({ downloaded, pending: await store.pending(), needsAttention: incomplete }),
  };
};
