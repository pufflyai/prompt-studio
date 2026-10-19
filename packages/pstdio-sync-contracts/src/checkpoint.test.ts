import { expect, test } from "bun:test";
import { coverageAckSchema, liveFrameSchema, sealCheckpoint, validateCheckpoint } from "./checkpoint";

const scope = { accountId: "a", workbenchId: "w", extensionId: "e" };

test("checkpoint envelopes seal the complete document and projection group and reject alpha mismatches", async () => {
  const group = await sealCheckpoint({
    protocolVersion: 2,
    scope,
    epoch: "restore",
    generation: 0,
    environmentId: "a",
    sequence: 1,
    parents: [],
    document: { recordId: "document", generation: 0, recoveryRevision: 1 },
    changes: [
      { recordId: "document", expectedRevision: 0, baseDeleted: false, shared: { kind: "text", update: "AAA=" } },
    ],
  });
  expect(await validateCheckpoint(group)).toEqual(group);
  await expect(validateCheckpoint({ ...group, epoch: "different" })).rejects.toThrow("fingerprint");
  await expect(validateCheckpoint({ ...group, protocolVersion: 1 })).rejects.toThrow();
  await expect(validateCheckpoint({ ...group, changes: [] })).rejects.toThrow();
  await expect(validateCheckpoint({ ...group, unknown: true })).rejects.toThrow();
});

test("coverage and live envelopes require scope, restore epoch, generation and explicit recovery accounting", () => {
  expect(
    coverageAckSchema.safeParse({
      protocolVersion: 2,
      scope,
      epoch: "restore",
      generation: 0,
      environmentId: "a",
      cut: 0,
      snapshotHash: "0".repeat(64),
      branches: [],
      recovery: [],
    }).success,
  ).toBe(true);
  expect(coverageAckSchema.safeParse({ protocolVersion: 2, scope, cut: 0 }).success).toBe(false);
  expect(
    liveFrameSchema.safeParse({
      protocolVersion: 1,
      scope,
      epoch: "restore",
      documentId: "doc",
      generation: 0,
      kind: "update",
      payload: "",
    }).success,
  ).toBe(false);
});

test("checkpoint projection edits use the same invariants as grouped mutations", async () => {
  const body = {
    protocolVersion: 2 as const,
    scope,
    epoch: "restore",
    generation: 0,
    environmentId: "a",
    sequence: 1,
    parents: [],
    document: { recordId: "document", generation: 0, recoveryRevision: 1 },
    changes: [
      {
        recordId: "document",
        expectedRevision: 0,
        baseDeleted: false,
        shared: { kind: "text" as const, update: "AAA=" },
      },
    ],
  };
  await expect(
    sealCheckpoint({
      ...body,
      changes: [...body.changes, { recordId: "noop", expectedRevision: 0, baseDeleted: false }],
    }),
  ).rejects.toThrow("contain an edit");
  await expect(
    sealCheckpoint({
      ...body,
      resolution: {
        conflictId: "b:1",
        expectedConflicts: [{ conflictId: "b:1", revision: 1 }],
        capturedOperationIds: ["b:1"],
        expectedInputs: [],
      },
    }),
  ).rejects.toThrow();
});
