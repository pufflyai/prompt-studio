import { expect, test } from "bun:test";
import { measureFiles, reconcileObjects } from "./storage-audit";

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
