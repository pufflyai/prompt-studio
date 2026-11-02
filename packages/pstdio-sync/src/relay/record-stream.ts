import type { ReadResult, StateInfo, StoredUpdate } from "pstdio-sync-contracts";
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
  const updateBytes = (cursor: RecordStreamCursor, updates: StoredUpdate[], byteLengths: number[]) =>
    updates.reduce((sum, update, index) => (update.sequence > cursor.through ? sum + byteLengths[index]! : sum), 0);

  /**
   * Merges a latest state this device must load: a founding state, or one that replaced removed
   * updates. Null when the state cannot be read, so the cursor stays and the next pass retries it.
   */
  const load = async (cursor: RecordStreamCursor, state: StateInfo) => {
    downloaded = false;
    const frames = await reader.openLatest(state);
    if (!frames) return null;
    // The state covers every sequence this device skipped, or it founds a new stream.
    const next = { ...(await withState(cursor, state)), after: state.through, skipped: false };
    const { rejected, cursor: saved } = await store.merge(addFrames(new Map(), frames), "repair", next);
    await skippedRecords(rejected);
    return saved;
  };
  // A founding state can hold records that no update carries; every device loads it once.
  const founding = (cursor: RecordStreamCursor, state: StateInfo | null) =>
    !!state && state.baseStateId === null && state.stateId !== cursor.stateId;

  const applyPage = async (cursor: RecordStreamCursor, result: Extract<ReadResult, { status: "updates" }>) => {
    const updates = checkPage(result, cursor.after);
    if (updates.length) downloaded = false;
    const next = await withState(cursor, result.state);
    if (!updates.length && next === cursor) return cursor;
    const { frames, byteLengths } = await reader.openFrames(updates);
    const { rejected, cursor: applied } = await store.apply(frames, {
      ...next,
      after: updates.at(-1)?.sequence ?? cursor.after,
      pendingBytes: next.pendingBytes + updateBytes(next, updates, byteLengths),
    });
    for (const index of rejected)
      await quarantine({ kind: "update", id: updates[index]!.updateId, envelope: updates[index] });
    return applied;
  };

  const lost = (cursor: RecordStreamCursor, result: ReadResult) =>
    (!result.state && result.lastSequence === 0 && !!cursor.stateId) ||
    (result.status === "state-required" && !result.state);

  /** Applies everything the relay holds after the cursor, a page per transaction. Null when the relay lost the stream. */
  const read = async (start: RecordStreamCursor): Promise<RecordStreamCursor | null> => {
    let cursor = start;
    while (true) {
      const result = await relay.read(cursor.after);
      if (lost(cursor, result)) return null;
      if (result.status === "state-required" || founding(cursor, result.state)) {
        const loaded = await load(cursor, result.state!);
        if (!loaded) return cursor;
        cursor = loaded;
        continue;
      }
      if (result.state && result.state.stateId !== cursor.stateId && result.state.through < cursor.after) {
        // A peer compacted only part of our known tail. Replay the remaining updates to rebuild
        // their byte count from the new base; applying their Yjs data again is idempotent.
        cursor = { ...(await withState(cursor, result.state)), after: result.state.through };
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
      const current = records.flatMap((record) => snapshot.assets.get(record.recordId) ?? []);
      // A compaction only lists files that earlier updates already uploaded.
      const assets = await files.upload(current, !found);
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
    const next = {
      joined: true,
      after: through,
      stateId: state.stateId,
      through,
      pendingBytes: 0,
      stateBytes: bytes,
      skipped: false,
    };
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
    // One save larger than an update travels as a blob, so it still arrives as one unit (R4). The
    // blob keeps the file references too: thousands of them would not fit in the update either.
    if (frame.length > recordFrameLimit) {
      const sealed = await sealBlob(space, frame);
      await relay.blobs!.put(sealed.blobId, sealed.bytes);
      const pointer = { blobId: sealed.blobId, byteLength: sealed.bytes.length };
      frame = encodeRecordFrame({ records: [], assets: [], blob: pointer });
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
    let skipped = false;
    let pendingBytes = 0;
    while (true) {
      const result = await relay.read(after);
      if (result.state && result.state.stateId !== state?.stateId) {
        state = result.state;
        const frames = await reader.openLatest(state);
        // Adopting without the stream's records would upload unrelated histories; wait instead.
        if (!frames) return null;
        remote = addFrames(new Map(), frames);
        after = state.through;
        // A newer latest state covers every update skipped before it.
        skipped = false;
        pendingBytes = 0;
        continue;
      }
      if (result.status === "state-required") throw new Error("Relay is missing updates after its latest state");
      const updates = checkPage(result, after);
      const { frames, byteLengths } = await reader.openFrames(updates);
      pendingBytes += byteLengths.reduce((sum, bytes) => sum + bytes, 0);
      if (frames.includes(null)) skipped = true;
      addFrames(remote, frames);
      after = updates.at(-1)?.sequence ?? after;
      if (!result.more) return { remote, after, state, skipped, pendingBytes };
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
    const { remote, after, state, skipped, pendingBytes } = downloaded;
    const joined = {
      ...(await withState(cursor, state)),
      joined: true,
      after,
      pendingBytes,
      skipped: cursor.skipped || skipped,
    };
    const { rejected, cursor: saved } = await store.merge(remote, "adopt", joined);
    await skippedRecords(rejected);
    return saved;
  };

  // Updates after the latest state outgrew it; a device that has them all replaces it (R18, R23).
  // Small owners also replace a long tail, so a new device does not replay thousands of updates.
  // A device that skipped data would claim to cover it, so only a complete one replaces the state.
  const due = (cursor: RecordStreamCursor) =>
    !incomplete &&
    !cursor.skipped &&
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
      if (cursor.skipped) incomplete = true;
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
