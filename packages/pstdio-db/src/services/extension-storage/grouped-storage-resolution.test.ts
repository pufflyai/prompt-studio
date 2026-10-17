import { afterEach, expect, test } from "bun:test";
import { openGroupedTestStorage } from "./grouped-storage-test-fixture";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

const localConflict = async () => {
  const { records } = await openGroupedTestStorage(cleanup);
  const base = await records.read("note");
  await records.commit({
    operationId: "first",
    edits: [{ recordId: "note", expectedRevision: base.revision, replace: "first" }],
  });
  await records.commit({
    operationId: "alternative",
    edits: [{ recordId: "note", expectedRevision: base.revision, replace: "alternative" }],
  });
  const inspected = await records.inspect("alternative");
  return {
    records,
    proposal: {
      operationId: "proposal",
      conflictId: inspected.conflictId,
      choose: "local" as const,
      expectedConflicts: inspected.expectedConflicts,
      expectedInputs: inspected.expectedInputs,
      capturedOperationIds: inspected.capturedOperationIds,
    },
  };
};

test("a local resolution preserves edits made after its explicit capture", async () => {
  const { records, proposal } = await localConflict();
  const branch = await records.read("note", { operationId: "alternative" });
  await records.commit({
    operationId: "late",
    edits: [{ recordId: "note", expectedRevision: branch.revision, replace: "late work" }],
  });
  expect((await records.resolve(proposal)).status).toBe("saved-locally");
  expect((await records.read("note")).value).toBe("alternative");
  const retained = await records.inspect("late");
  expect(retained.capturedOperationIds).toContain("late");
  expect(retained.alternatives.find((entry) => entry.operationId === "late")!.records[0].value).toBe("late work");
  expect(
    (
      await records.resolve({
        operationId: "resolve-late",
        conflictId: retained.conflictId,
        choose: "local",
        expectedConflicts: retained.expectedConflicts,
        expectedInputs: retained.expectedInputs,
        capturedOperationIds: retained.capturedOperationIds,
      })
    ).status,
  ).toBe("saved-locally");
  expect((await records.read("note")).value).toBe("late work");
});

test("a stale local resolution preserves the current value and its proposed branch", async () => {
  const { records, proposal } = await localConflict();
  const current = await records.read("note");
  await records.commit({
    operationId: "newer",
    edits: [{ recordId: "note", expectedRevision: current.revision, replace: "newer" }],
  });
  expect((await records.resolve(proposal)).status).toBe("conflict");
  expect((await records.read("note")).value).toBe("newer");
  expect((await records.read("note", { operationId: "proposal" })).value).toBe("alternative");
});

test("local-only resolution preserves the complete branch and permits later guarded edits without a relay acknowledgment", async () => {
  const { records } = await openGroupedTestStorage(cleanup);
  await records.commit({
    operationId: "seed",
    edits: [{ recordId: "note", expectedRevision: (await records.read("note")).revision, replace: "base" }],
  });
  const base = await records.read("note");
  await records.commit({
    operationId: "first",
    edits: [{ recordId: "note", expectedRevision: base.revision, replace: "first" }],
  });
  await records.commit({
    operationId: "alternative",
    edits: [{ recordId: "note", expectedRevision: base.revision, replace: "alternative" }],
  });
  const alternative = await records.read("note", { operationId: "alternative" });
  await records.commit({
    operationId: "dependent",
    edits: [
      { recordId: "note", expectedRevision: alternative.revision, replace: "later alternative" },
      { recordId: "joined", expectedRevision: (await records.read("joined")).revision, replace: "whole branch" },
    ],
  });
  const inspection = await records.inspect("alternative");
  expect(inspection.capturedOperationIds).toEqual(["alternative", "dependent"]);
  const proposal = {
    operationId: "resolve-locally",
    conflictId: inspection.conflictId,
    choose: "local" as const,
    expectedConflicts: inspection.expectedConflicts,
    expectedInputs: inspection.expectedInputs,
    capturedOperationIds: inspection.capturedOperationIds,
  };
  expect(await records.resolve(proposal)).toMatchObject({ status: "saved-locally" });
  expect((await records.read("note")).value).toBe("later alternative");
  expect((await records.read("joined")).value).toBe("whole branch");
  const chosen = await records.read("note");
  expect(
    await records.commit({
      operationId: "after-proposal",
      edits: [{ recordId: "note", expectedRevision: chosen.revision, replace: "continue locally" }],
    }),
  ).toMatchObject({ status: "saved-locally" });
  expect((await records.read("note")).value).toBe("continue locally");
  expect(await records.resolve(proposal)).toMatchObject({ status: "saved-locally" });
});
