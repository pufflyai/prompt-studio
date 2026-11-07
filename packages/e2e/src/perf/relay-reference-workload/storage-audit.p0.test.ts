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

test("receipt-index nodes count against the record bound and never against the file bound", () => {
  const rows = {
    states: [{ documentId: "owner", stateId: "s", byteLength: 1_000, blobIds: ["chunk"], replacedAt: null }],
    updates: [{ documentId: "owner", byteLength: 100, coveredAt: null, blobIds: ["index-root", "file"] }],
    blobs: [
      { blobId: "chunk", byteLength: 4_000 },
      { blobId: "index-root", byteLength: 1_043 },
      { blobId: "index-leaf", byteLength: 3_600 },
      { blobId: "file", byteLength: 50_000 },
    ],
  };
  const unit = {
    owner: { workbenchId: "project", extensionId: "owner" },
    secret: "secret",
    chunks: new Set(["chunk"]),
    frames: new Set<string>(),
    files: new Set(["file"]),
    index: new Set(["index-root", "index-leaf"]),
  };
  const audit = auditStorage(
    { rows, expectedObjects: [], objects: [], missingBlobMappings: [], unfinishedUploads: [] } as unknown as Parameters<
      typeof auditStorage
    >[0],
    new Map([["owner", unit]]),
  );
  expect(audit.unknownBlobs).toEqual([]);
  expect(audit.documents[0]?.files).toMatchObject({ storedBytes: 50_000, latestBytes: 50_000, passed: true });
  expect(audit.documents[0]?.records.storedBytes).toBe(1_000 + 100 + 4_000 + 1_043 + 3_600);
});
