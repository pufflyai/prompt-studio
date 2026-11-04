import {
  recordStreamStateSchema,
  recordStreamSummarySchema,
  type StateInfo,
  type StoredUpdate,
} from "pstdio-sync-contracts";
import * as Y from "yjs";
import { openBlob, openState, openSummary, openUpdate, type SyncSpace, UnreadableSyncData } from "../encryption";
import { decodeBytes } from "../shared";
import type { DocumentRelay, SyncFailure } from "./document-sync-types";
import { decodeOrderedEntry, orderedEntryId } from "./ordered-stream-entry";
import type { createRecordAssets } from "./record-assets";
import { decodeRecordFrame as decodeFrame, type RecordFrame } from "./record-frames";

// Downloads that run at once, so a page of small frames that name large blobs stays bounded.
const parallelDownloads = 8;

const mapLimited = async <T, R>(items: T[], action: (item: T) => Promise<R>) => {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await action(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallelDownloads, items.length) }, worker));
  return results;
};

/** Validate every entry in the expected client format before applying any part of a frame (R4). */
const decodeRecordFrame = async (bytes: Uint8Array, format?: "ordered", allowPointer = false) => {
  const frame = decodeFrame(bytes);
  if (format !== frame.format) throw new Error("Incompatible record stream format");
  if (frame.blob && !allowPointer) throw new Error("Nested record pointers are not supported");
  for (const record of frame.records) {
    if (!format) Y.decodeUpdate(record.bytes);
    else if (orderedEntryId(await decodeOrderedEntry(record.bytes)) !== record.recordId)
      throw new Error("Ordered entry address does not match its payload");
  }
  return frame;
};

/** False when a referenced file cannot be decrypted or does not match; network errors still throw. */
const downloaded = async (files: ReturnType<typeof createRecordAssets>, frames: RecordFrame[]) => {
  try {
    for (const frame of frames) await files.download(frame.assets);
    return true;
  } catch (error) {
    if (error instanceof UnreadableSyncData) return false;
    throw error;
  }
};

/** Opens data as `decode` reads it, or null when the bytes cannot be decrypted or decoded. */
const readable = async <T>(decode: () => Promise<T> | T) => {
  try {
    return await decode();
  } catch {
    return null;
  }
};

/**
 * Reads the record stream's frames and latest states. Network errors throw, so the sync retries;
 * only data that cannot be decrypted or decoded is set aside.
 */
export const createRecordStreamReader = (input: {
  space: SyncSpace;
  documentId: string;
  relay: DocumentRelay;
  files: ReturnType<typeof createRecordAssets>;
  quarantine(failure: SyncFailure): Promise<void>;
  recordFormat?: "ordered";
}) => {
  const { space, documentId, relay, files } = input;
  const openFrame = async (update: StoredUpdate) => {
    let byteLength = decodeBytes(update.payload).length;
    const unreadable = async () => {
      await input.quarantine({ kind: "update", id: update.updateId, envelope: update });
      return { frame: null, byteLength };
    };
    let frame = await readable(async () =>
      decodeRecordFrame(await openUpdate(space, documentId, update), input.recordFormat, true),
    );
    if (!frame) return unreadable();
    if (frame.blob) {
      const { blobId } = frame.blob;
      const bytes = await relay.blobs!.get(blobId);
      byteLength += bytes.length;
      frame = await readable(async () => decodeRecordFrame(await openBlob(space, blobId, bytes), input.recordFormat));
      if (!frame) return unreadable();
    }
    return (await downloaded(files, [frame])) ? { frame, byteLength } : unreadable();
  };
  return {
    async openFrames(updates: StoredUpdate[]) {
      const received = await mapLimited(updates, openFrame);
      return { frames: received.map((item) => item.frame), byteLengths: received.map((item) => item.byteLength) };
    },
    /** A latest state's records, or null when it cannot be read. */
    async openLatest(state: StateInfo) {
      const unreadable = async () => {
        await input.quarantine({ kind: "state", id: state.stateId, envelope: state });
        return null;
      };
      const bytes = await relay.state(state);
      const index = await readable(async () => {
        const index = recordStreamStateSchema.parse(
          JSON.parse(new TextDecoder().decode(await openState(space, documentId, state, bytes))),
        );
        if (index.format !== input.recordFormat) throw new Error("Incompatible record stream format");
        return index;
      });
      if (!index) return unreadable();
      const chunks = await mapLimited(index.chunks, async (chunk) => {
        const sealed = await relay.blobs!.get(chunk.blobId);
        return readable(async () => decodeRecordFrame(await openBlob(space, chunk.blobId, sealed), input.recordFormat));
      });
      if (chunks.some((chunk) => !chunk)) return unreadable();
      const frames = chunks as RecordFrame[];
      return (await downloaded(files, frames)) ? frames : unreadable();
    },
    /** Verify the format before even a caught-up device uses this state as its next CAS base. */
    async summary(state: StateInfo) {
      const summary = await readable(async () =>
        recordStreamSummarySchema.parse(
          JSON.parse(new TextDecoder().decode(await openSummary(space, documentId, state))),
        ),
      );
      if (!summary || summary.format !== input.recordFormat) {
        await input.quarantine({ kind: "state", id: state.stateId, envelope: state });
        throw new UnreadableSyncData();
      }
      return { bytes: summary.bytes, receiptRoot: summary.receiptRoot };
    },
  };
};
