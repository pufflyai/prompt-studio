import { type ReadResult, recordStreamStateSchema, type StateInfo, type StoredUpdate } from "pstdio-sync-contracts";
import { decodeBytes } from "../encoding";
import { openBlob, openState, openUpdate, sealBlob, sealState, sealUpdate } from "../encryption";
import { latestStateLimits } from "./document-sync";
import { createRecordAssets } from "./record-assets";
import { decodeRecordFrame, encodeRecordFrame, type RecordFrame, recordFrameCost } from "./record-frames";
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
  const skipped = async (recordIds: string[]) => {
    for (const recordId of recordIds)
      await quarantine({ kind: "update", id: `record:${recordId}`, envelope: { recordId } });
  };
  const blob = async (blobId: string) => openBlob(space, blobId, await relay.blobs!.get(blobId));

  const openFrame = async (update: StoredUpdate) => {
    try {
      const frame = decodeRecordFrame(await openUpdate(space, documentId, update));
      const whole = frame.blob ? decodeRecordFrame(await blob(frame.blob.blobId)) : frame;
      await files.download(whole.assets);
      return whole;
    } catch {
      await quarantine({ kind: "update", id: update.updateId, envelope: update });
      return null;
    }
  };
  /** Downloads a latest state's records, or null when it cannot be read. */
  const openLatest = async (state: StateInfo) => {
    try {
      const bytes = await openState(space, documentId, state, await relay.state(state));
      const index = recordStreamStateSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
      const remote = new Map<string, Uint8Array[]>();
      for (const chunk of index.chunks) {
        const frame = decodeRecordFrame(await blob(chunk.blobId));
        await files.download(frame.assets);
        addFrames(remote, [frame]);
      }
      return remote;
    } catch {
      await quarantine({ kind: "state", id: state.stateId, envelope: state });
      return null;
    }
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
  const withState = (cursor: RecordStreamCursor, state: StateInfo | null) =>
    state && state.stateId !== cursor.stateId
      ? { ...cursor, stateId: state.stateId, through: state.through, pendingBytes: 0 }
      : cursor;
  const updateBytes = (cursor: RecordStreamCursor, updates: StoredUpdate[]) =>
    updates
      .filter((update) => update.sequence > cursor.through)
      .reduce((sum, update) => sum + decodeBytes(update.payload).length, 0);

  /** Merges a latest state this device must load: a founding state, or one that replaced removed updates. */
  const load = async (cursor: RecordStreamCursor, state: StateInfo) => {
    const next = { ...withState(cursor, state), after: Math.max(cursor.after, state.through) };
    await skipped(await store.merge((await openLatest(state)) ?? new Map(), "repair", next));
    return next;
  };
  // A founding state can hold records that no update carries; every device loads it once.
  const founding = (cursor: RecordStreamCursor, state: StateInfo | null) =>
    !!state && state.baseStateId === null && state.stateId !== cursor.stateId;

  const applyPage = async (cursor: RecordStreamCursor, result: Extract<ReadResult, { status: "updates" }>) => {
    const updates = checkPage(result, cursor.after);
    const next = withState(cursor, result.state);
    if (!updates.length && next === cursor) return cursor;
    const frames = await Promise.all(updates.map(openFrame));
    const applied = {
      ...next,
      after: updates.at(-1)?.sequence ?? cursor.after,
      pendingBytes: next.pendingBytes + updateBytes(next, updates),
    };
    await skipped(await store.apply(frames, applied));
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
      const assets = await files.upload(await store.assets(records.map((record) => record.recordId)));
      for (const reference of assets) assetBlobs.add(reference.blobId);
      const sealed = await sealBlob(space, encodeRecordFrame({ records, assets }));
      await relay.blobs!.put(sealed.blobId, sealed.bytes);
      chunks.push({ blobId: sealed.blobId, byteLength: sealed.bytes.length });
    }
    const encoder = new TextEncoder();
    const through = found ? 0 : cursor.after;
    const state = await sealState(space, documentId, {
      baseStateId: found ? null : cursor.stateId,
      through,
      state: encoder.encode(JSON.stringify({ version: 1, chunks })),
      summary: encoder.encode(JSON.stringify({ records: snapshot.records.length })),
      blobIds: [...chunks.map((chunk) => chunk.blobId), ...assetBlobs],
    });
    if (!(await relay.replace(state))) return null;
    const next = { joined: true, stateId: state.stateId, after: through, through, pendingBytes: 0 };
    // Every device loads a founding state, so the saves it includes need no separate upload.
    await store.published(next, found ? snapshot.outbox : 0);
    return next;
  };

  /** Sends the oldest saved local changes as one update. False when nothing was waiting. */
  const push = async () => {
    const entries = await store.outbox(recordFrameLimit);
    if (!entries.length) return false;
    const records = entries.flatMap((entry) => entry.records);
    const assets = await files.upload(await store.assets(records.map((record) => record.recordId)));
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

  /** Collects every record the relay holds, for a device that has not joined yet. */
  const download = async () => {
    let remote = new Map<string, Uint8Array[]>();
    let after = 0;
    let state: StateInfo | null = null;
    while (true) {
      const result = await relay.read(after);
      if (result.state && result.state.stateId !== state?.stateId) {
        state = result.state;
        remote = (await openLatest(state)) ?? new Map();
        after = state.through;
        continue;
      }
      if (result.status === "state-required") throw new Error("Relay is missing updates after its latest state");
      const updates = checkPage(result, after);
      addFrames(remote, await Promise.all(updates.map(openFrame)));
      after = updates.at(-1)?.sequence ?? after;
      if (!result.more) return { remote, after, state };
    }
  };

  /** A device's first sync: the first device founds the stream with its records, later ones adopt them. */
  const join = async (cursor: RecordStreamCursor) => {
    const first = await relay.read(0);
    if (!first.state && first.lastSequence === 0) {
      const founded = await publish(cursor, true);
      if (founded) return founded;
    }
    const { remote, after, state } = await download();
    const joined = { ...withState(cursor, state), joined: true, after, pendingBytes: 0 };
    await skipped(await store.merge(remote, "adopt", joined));
    return joined;
  };

  // Updates after the latest state passed the size limit; a device that has them all replaces it (R18).
  const due = (cursor: RecordStreamCursor) =>
    !incomplete &&
    cursor.after > cursor.through &&
    (cursor.pendingBytes > limits.bytes || cursor.after - cursor.through > limits.updates);

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
      let cursor = await store.open(space.generation);
      if (!cursor.joined) cursor = await join(cursor);
      while (true) {
        const next = await send(await read(cursor), cursor);
        if (!next) break;
        cursor = next;
      }
      downloaded = !incomplete;
    },
    status: async () => ({ downloaded, pending: await store.pending(), needsAttention: incomplete }),
  };
};
