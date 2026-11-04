import { expect, test } from "bun:test";
import { createSyncSpace, sealBlob, sealState, sealUpdate } from "../encryption";
import { applyOrderedOperation, prepareOrderedOperation } from "../records/ordered-operation";
import type { DocumentRelay, SyncFailure } from "./document-sync-types";
import { encodeOrderedEntry } from "./ordered-stream-entry";
import { createRecordAssets } from "./record-assets";
import { encodeRecordFrame } from "./record-frames";
import { createRecordStreamReader } from "./record-stream-reader";

test("the ordered reader opens encrypted updates, large-frame pointers and checkpoint chunks", async () => {
  const space = await createSyncSpace({
    projectId: "project",
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const operation = await prepareOrderedOperation(
    { operationId: "seed", edits: [{ recordId: "card", replace: "Ship\nlist" }] },
    new Map(),
  );
  const record = applyOrderedOperation(new Map(), operation, "epoch").records[0]!;
  const records = [encodeOrderedEntry({ type: "record", record })];
  const frame = encodeRecordFrame({ format: "ordered", records, assets: [] });
  const blobs = new Map<string, Uint8Array>();
  const chunk = await sealBlob(space, frame);
  blobs.set(chunk.blobId, chunk.bytes);
  let state = await sealState(space, "document", {
    baseStateId: null,
    through: 0,
    state: new TextEncoder().encode(
      JSON.stringify({
        version: 1,
        format: "ordered",
        chunks: [{ blobId: chunk.blobId, byteLength: chunk.bytes.length }],
      }),
    ),
    summary: new Uint8Array(),
    blobIds: [chunk.blobId],
  });
  const unsupported = async () => {
    throw new Error("Not used by this reader");
  };
  const relay: DocumentRelay = {
    read: unsupported,
    update: unsupported,
    replace: unsupported,
    state: async () => Uint8Array.from(Buffer.from(state.payload, "base64")),
    blobs: {
      put: async (id, bytes) => {
        blobs.set(id, bytes);
      },
      get: async (id) => blobs.get(id)!,
    },
  };
  const files = createRecordAssets({ space, references: { get: async () => undefined, set: async () => {} } });
  const failures: SyncFailure[] = [];
  const reader = createRecordStreamReader({
    space,
    documentId: "document",
    relay,
    files,
    recordFormat: "ordered",
    quarantine: async (failure) => {
      failures.push(failure);
    },
  });
  const stored = async (bytes: Uint8Array, sequence: number) => ({
    ...(await sealUpdate(space, "document", bytes, [])),
    sequence,
    deviceId: "source",
    createdAt: new Date().toISOString(),
  });
  const direct = await stored(frame, 1);
  const pointer = await stored(
    encodeRecordFrame({
      format: "ordered",
      records: [],
      assets: [],
      blob: { blobId: chunk.blobId, byteLength: chunk.bytes.length },
    }),
    2,
  );
  const opened = await reader.openFrames([direct, pointer]);
  expect(opened.frames.map((entry) => entry?.records)).toEqual([records, records]);
  expect(
    (await reader.openLatest({ ...state, byteLength: 0, deviceId: "source", createdAt: new Date().toISOString() }))?.[0]
      ?.records,
  ).toEqual(records);
  expect(failures).toEqual([]);

  const wrongFormat = await stored(encodeRecordFrame({ records, assets: [] }), 3);
  const wrongAddress = await stored(
    encodeRecordFrame({
      format: "ordered",
      records: [{ ...records[0]!, recordId: "different" }],
      assets: [],
    }),
    4,
  );
  expect((await reader.openFrames([wrongFormat, wrongAddress])).frames).toEqual([null, null]);
  expect(failures.map((failure) => failure.id)).toEqual([wrongFormat.updateId, wrongAddress.updateId]);
  const legacy = createRecordStreamReader({ space, documentId: "document", relay, files, quarantine: async () => {} });
  expect((await legacy.openFrames([direct])).frames).toEqual([null]);

  const emptyLegacy = await sealState(space, "document", {
    baseStateId: null,
    through: 0,
    state: new TextEncoder().encode(JSON.stringify({ version: 1, chunks: [] })),
    summary: new Uint8Array(),
    blobIds: [],
  });
  state = emptyLegacy;
  const emptyResult = await reader.openLatest({ ...state, byteLength: 0, deviceId: "source", createdAt: "now" });
  const mixed = await stored(
    encodeRecordFrame({
      format: "ordered",
      records,
      assets: [],
      blob: { blobId: chunk.blobId, byteLength: chunk.bytes.length },
    }),
    5,
  );
  const pointerBytes = encodeRecordFrame({
    format: "ordered",
    records: [],
    assets: [],
    blob: { blobId: chunk.blobId, byteLength: chunk.bytes.length },
  });
  const nested = await sealBlob(space, pointerBytes);
  blobs.set(nested.blobId, nested.bytes);
  const doublePointer = await stored(
    encodeRecordFrame({
      format: "ordered",
      records: [],
      assets: [],
      blob: { blobId: nested.blobId, byteLength: nested.bytes.length },
    }),
    6,
  );
  const pointerResults = (await reader.openFrames([mixed, doublePointer])).frames;
  state = await sealState(space, "document", {
    baseStateId: null,
    through: 0,
    state: new TextEncoder().encode(
      JSON.stringify({
        version: 1,
        format: "ordered",
        chunks: [{ blobId: nested.blobId, byteLength: nested.bytes.length }],
      }),
    ),
    summary: new Uint8Array(),
    blobIds: [nested.blobId],
  });
  const nestedLatest = await reader.openLatest({ ...state, byteLength: 0, deviceId: "source", createdAt: "now" });
  expect([emptyResult, ...pointerResults, nestedLatest]).toEqual([null, null, null, null]);
  state = await sealState(space, "document", {
    baseStateId: null,
    through: 0,
    state: new TextEncoder().encode(JSON.stringify({ version: 1, format: "ordered", chunks: [] })),
    summary: new Uint8Array(),
    blobIds: [],
  });
  const info = { ...state, byteLength: 0, deviceId: "source", createdAt: "now" };
  expect(await reader.openLatest(info)).toEqual([]);
  expect(await legacy.openLatest(info)).toBeNull();
  state = emptyLegacy;
  expect(await legacy.openLatest({ ...state, byteLength: 0, deviceId: "source", createdAt: "now" })).toEqual([]);
});
