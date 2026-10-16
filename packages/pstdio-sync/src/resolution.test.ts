import { expect, test } from "bun:test";
import { sealMutation } from "pstdio-sync-contracts";
import { entryFor } from "./authoring";
import { projectGroups } from "./projection";
import { applyRecordChange } from "./records";
import { inspectConflict, resolutionEntry } from "./resolution";
import { conflictedState } from "./sync-state.fixture";

test("a resolved local conflict cannot be chosen again with fresh record inputs", async () => {
  const { state } = await conflictedState();
  const inspection = await inspectConflict(state, "writer", "branch");
  const proposal = {
    conflictId: inspection.conflictId,
    capturedOperationIds: inspection.capturedOperationIds,
    expectedConflicts: inspection.expectedConflicts,
    expectedInputs: inspection.expectedInputs,
  };
  state.journal.push(await resolutionEntry(state, { ...proposal, operationId: "first", choose: "local" }, "writer"));
  const current = await projectGroups(state, "writer");
  expect(current.conflicts).toEqual([]);
  state.journal.push(
    await resolutionEntry(
      state,
      {
        ...proposal,
        operationId: "stale-root",
        choose: "remote",
        expectedInputs: [{ recordId: "note", revision: current.read("note").revision }],
      },
      "writer",
    ),
  );
  const after = await projectGroups(state, "writer");
  expect(after.outcomes.get("stale-root")?.status).toBe("conflict");
  expect(after.read("note").value).toBe(current.read("note").value);
});

test("a fresh relay conflict choice uses the current local records and conflict revisions", async () => {
  const { state } = await conflictedState();
  const current = (await projectGroups(state, "writer")).read("note");
  state.journal.push(
    await entryFor(
      state,
      {
        operationId: "local-progress",
        edits: [{ recordId: "note", expectedRevision: current.revision, replace: "new local value" }],
      },
      "writer",
    ),
  );
  const inspection = await inspectConflict(state, "writer", "branch");
  expect(inspection.accepted[0].value).toBe("new local value");
  const view = await projectGroups(state, "writer");
  expect(inspection.revision).toBe(view.conflicts[0].revision);
  expect(inspection.expectedInputs[0].revision).toBe(view.read("note").revision);
  state.journal.push(
    await resolutionEntry(
      state,
      {
        operationId: "resolve",
        conflictId: inspection.conflictId,
        choose: "local",
        expectedConflicts: inspection.expectedConflicts,
        capturedOperationIds: inspection.capturedOperationIds,
        expectedInputs: inspection.expectedInputs,
      },
      "writer",
    ),
  );
  const resolved = await projectGroups(state, "writer");
  expect(resolved.outcomes.get("resolve")?.status).toBe("pending");
  expect(resolved.read("note").value).toBe("retained");
  expect(resolved.conflicts).toEqual([]);
});

test("a fresh competing choice guards resolved ancestry without treating it as an active conflict", async () => {
  const { state } = await conflictedState();
  const initial = await inspectConflict(state, "writer", "branch");
  const proposal = {
    conflictId: initial.conflictId,
    expectedConflicts: initial.expectedConflicts,
    expectedInputs: initial.expectedInputs,
    capturedOperationIds: initial.capturedOperationIds,
  };
  const choice = await resolutionEntry(state, { ...proposal, operationId: "choice", choose: "local" }, "writer");
  const late = await resolutionEntry(state, { ...proposal, operationId: "late", choose: "remote" }, "other");
  const snapshot = state.accepted!;
  state.journal.push(choice, late);
  const seal = (entry: typeof choice) => sealMutation({ ...entry.mutation, protocolVersion: 1, scope: snapshot.scope });
  const accepted = await seal(choice);
  const rejected = await seal(late);
  snapshot.checkpoint = { epoch: "relay", sequence: 2 };
  snapshot.journalSequence = 4;
  snapshot.records.note = applyRecordChange(snapshot.records.note, accepted.changes[0]);
  snapshot.receipts.choice = {
    order: 3,
    operationId: "choice",
    mutation: accepted,
    fingerprint: accepted.fingerprint,
    status: "accepted",
    checkpoint: snapshot.checkpoint,
  };
  snapshot.receipts.late = {
    order: 4,
    operationId: "late",
    mutation: rejected,
    fingerprint: rejected.fingerprint,
    status: "conflict",
    checkpoint: null,
    conflictId: "branch",
  };
  snapshot.conflicts.branch.resolvedBy = "choice";
  snapshot.conflicts.branch.revision = 4;
  snapshot.conflicts.late = { conflictId: "late", revision: 1, recordIds: ["note"], alternativeOperationIds: ["late"] };
  const fresh = await inspectConflict(state, "other", "late");
  expect(fresh.expectedConflicts.map((conflict) => conflict.conflictId).sort()).toEqual(["branch", "late"]);
  expect(fresh.expectedConflicts.find((conflict) => conflict.conflictId === "branch")?.revision).toBe(4);
  state.journal.push(
    await resolutionEntry(
      state,
      {
        operationId: "retry",
        conflictId: "late",
        choose: "local",
        expectedConflicts: fresh.expectedConflicts,
        expectedInputs: fresh.expectedInputs,
        capturedOperationIds: fresh.capturedOperationIds,
      },
      "other",
    ),
  );
  const resolved = await projectGroups(state, "other");
  expect(resolved.outcomes.get("retry")?.status).toBe("pending");
  expect(resolved.conflicts).toEqual([]);
});
