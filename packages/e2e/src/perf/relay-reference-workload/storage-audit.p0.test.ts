import { expect, test } from "bun:test";
import { auditStorage, measureFiles, reconcileObjects } from "./storage-audit";

test("physical object accounting rejects unreferenced bytes, missing bytes and changed lengths", () => {
  const expected = [
    { key: "state", bytes: 10 },
    { key: "chunk", bytes: 100 },
  ];
  expect(reconcileObjects(expected, expected).passed).toBe(true);
  expect(reconcileObjects(expected, [...expected, { key: "orphan", bytes: 1000 }]).passed).toBe(false);
  expect(reconcileObjects(expected, expected.slice(0, 1)).passed).toBe(false);
  expect(reconcileObjects(expected, [{ key: "state", bytes: 11 }, expected[1]!]).passed).toBe(false);
});

test("file blobs have their own bound and shared current/grace references count once", () => {
  const rows = {
    states: [
      { documentId: "owner", stateId: "new", byteLength: 10, blobIds: ["file"], replacedAt: null },
      { documentId: "owner", stateId: "old", byteLength: 10, blobIds: ["file", "old-file"], replacedAt: "today" },
    ],
    updates: [],
    blobs: [
      { blobId: "file", byteLength: 100 },
      { blobId: "old-file", byteLength: 90 },
      { blobId: "orphan", byteLength: 1000 },
    ],
  };
  expect(measureFiles(rows, "owner", new Set(["file", "old-file", "orphan"]))).toMatchObject({
    latestBytes: 100,
    graceBytes: 90,
    storedBytes: 1190,
    limitBytes: 290,
    passed: false,
  });
});

test("receipt-index nodes count in record storage but add nothing to its allowance or the file bound", () => {
  const rows = {
    states: [
      { documentId: "owner", stateId: "new", byteLength: 1_000, blobIds: ["chunk", "root"], replacedAt: null },
      { documentId: "owner", stateId: "old", byteLength: 900, blobIds: ["old-chunk", "old-root"], replacedAt: "today" },
    ],
    updates: [{ documentId: "owner", byteLength: 100, coveredAt: null, blobIds: ["file"] }],
    blobs: [
      { blobId: "chunk", byteLength: 4_000 },
      { blobId: "old-chunk", byteLength: 3_000 },
      { blobId: "root", byteLength: 1_043 },
      { blobId: "old-root", byteLength: 1_041 },
      { blobId: "leaf", byteLength: 3_600 },
      { blobId: "file", byteLength: 50_000 },
    ],
  };
  const unit = {
    owner: { workbenchId: "project", extensionId: "owner" },
    secret: "secret",
    chunks: new Set(["chunk", "old-chunk"]),
    frames: new Set<string>(),
    files: new Set(["file"]),
    index: new Set(["root", "old-root", "leaf"]),
  };
  const storage = { rows, expectedObjects: [], objects: [], missingBlobMappings: [], unfinishedUploads: [] };
  const audit = auditStorage(storage as unknown as Parameters<typeof auditStorage>[0], new Map([["owner", unit]]));
  expect(audit.unknownBlobs).toEqual([]);
  expect(audit.documents[0]?.files).toMatchObject({ storedBytes: 50_000, latestBytes: 50_000, passed: true });
  expect(audit.documents[0]?.records).toMatchObject({
    latestBytes: 1_000 + 4_000,
    graceBytes: 900 + 3_000,
    storedBytes: 1_000 + 900 + 100 + 4_000 + 3_000 + 1_043 + 1_041 + 3_600,
    indexObjects: 3,
  });
});
