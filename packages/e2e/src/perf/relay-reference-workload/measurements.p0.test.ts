import { expect, test } from "bun:test";
import { measureDocument, type StorageRows } from "./measurements";

test("the storage bound includes encrypted chunks once and keeps file bytes separate", () => {
  const rows: StorageRows = {
    states: [
      { documentId: "owner", stateId: "current", byteLength: 10, blobIds: ["new", "file"], replacedAt: null },
      { documentId: "owner", stateId: "previous", byteLength: 8, blobIds: ["old", "file"], replacedAt: "today" },
    ],
    updates: [{ documentId: "owner", byteLength: 5, coveredAt: "today" }],
    blobs: [
      { blobId: "new", byteLength: 100 },
      { blobId: "old", byteLength: 90 },
      { blobId: "file", byteLength: 1000 },
    ],
  };
  expect(measureDocument(rows, "owner", new Set(["new", "old"]))).toEqual({
    latestBytes: 110,
    graceBytes: 103,
    storedBytes: 213,
    limitBytes: 323,
    passed: true,
    stateRows: 2,
    updateRows: 1,
    chunkObjects: 2,
  });
});

test("an unreferenced retained chunk is counted rather than hidden in the grace allowance", () => {
  const rows: StorageRows = {
    states: [{ documentId: "owner", stateId: "current", byteLength: 10, blobIds: ["new"], replacedAt: null }],
    updates: [],
    blobs: [
      { blobId: "new", byteLength: 100 },
      { blobId: "orphan", byteLength: 1000 },
    ],
  };
  const result = measureDocument(rows, "owner", new Set(["new", "orphan"]));
  expect(result.storedBytes).toBe(1110);
  expect(result.limitBytes).toBe(220);
  expect(result.passed).toBe(false);
});

test("a covered large-save frame is part of the grace copy once even when several updates reference it", () => {
  const rows: StorageRows = {
    states: [{ documentId: "owner", stateId: "current", byteLength: 10, blobIds: ["chunk"], replacedAt: null }],
    updates: [
      { documentId: "owner", byteLength: 5, coveredAt: "today", blobIds: ["frame"] },
      { documentId: "owner", byteLength: 5, coveredAt: "today", blobIds: ["frame"] },
    ],
    blobs: [
      { blobId: "chunk", byteLength: 100 },
      { blobId: "frame", byteLength: 1000 },
    ],
  };
  expect(measureDocument(rows, "owner", new Set(["chunk", "frame"]))).toMatchObject({
    graceBytes: 1010,
    storedBytes: 1120,
    limitBytes: 1230,
    passed: true,
  });
});
