import { expect, test } from "bun:test";
import { receiveSnapshot } from "./journal";
import { projectGroups } from "./projection";
import { conflictedState } from "./sync-state.fixture";

test("accepted and conflicting operation recovery evidence remains after an epoch rollback", async () => {
  const { state, before, latest } = await conflictedState();
  latest.receipts.winner.recoveryProof = "a".repeat(64);
  latest.receipts.branch.recoveryProof = "b".repeat(64);
  await receiveSnapshot(state, latest, state.accepted);
  const restored = {
    ...before,
    checkpoint: { epoch: "rollback", sequence: 0 },
    journalSequence: 0,
    records: {},
    receipts: {},
    conflicts: {},
  };
  await receiveSnapshot(state, restored, latest);
  expect(state.journal.map((entry) => entry.recoveryProof)).toEqual(["a".repeat(64), "b".repeat(64)]);
});

test("an older snapshot cannot hide a newer foreign conflict at the same accepted checkpoint", async () => {
  const { state, before, latest } = await conflictedState();
  await receiveSnapshot(state, before, latest);
  expect((await projectGroups(state, "observer")).conflicts.map((conflict) => conflict.conflictId)).toEqual(["branch"]);
  expect(state.accepted?.journalSequence).toBe(2);
});

test("a delayed old epoch cannot replace a restore received by a concurrent sync", async () => {
  const { state, before, latest } = await conflictedState();
  state.accepted = structuredClone(before);
  const restored = structuredClone(latest);
  restored.checkpoint.epoch = "restored";
  restored.receipts.winner.checkpoint!.epoch = "restored";
  await receiveSnapshot(state, restored, before);
  await receiveSnapshot(state, before, before);
  expect(state.accepted?.checkpoint.epoch).toBe("restored");
  expect((await projectGroups(state, "observer")).conflicts.map((conflict) => conflict.conflictId)).toEqual(["branch"]);
});

test("a fresh restore may replace the observed epoch with a lower journal sequence", async () => {
  const { state, before, latest } = await conflictedState();
  const restored = {
    ...before,
    checkpoint: { epoch: "restored", sequence: 0 },
    journalSequence: 0,
    records: {},
    receipts: {},
    conflicts: {},
  };
  await receiveSnapshot(state, restored, latest);
  expect(state.accepted?.checkpoint).toEqual({ epoch: "restored", sequence: 0 });
  expect(state.accepted?.journalSequence).toBe(0);
  expect(state.journal.map((entry) => entry.mutation.operationId)).toEqual(["winner", "branch"]);
});

test("a delayed pending receipt cannot hide a concurrent conflict with identical checkpoint counters", async () => {
  const { state, latest } = await conflictedState();
  const pending = structuredClone(latest);
  pending.receipts.branch.status = "pending";
  pending.receipts.branch.reason = "incomplete assets";
  delete pending.receipts.branch.conflictId;
  pending.conflicts = {};
  state.accepted = structuredClone(pending);
  await receiveSnapshot(state, latest, pending);
  await receiveSnapshot(state, pending, pending);
  expect(state.accepted?.receipts.branch.status).toBe("conflict");
  expect((await projectGroups(state, "observer")).conflicts.map((conflict) => conflict.conflictId)).toEqual(["branch"]);
});

test("a lower accepted checkpoint cannot replace current records when journal positions match", async () => {
  const { state, latest } = await conflictedState();
  const pending = structuredClone(latest);
  pending.checkpoint.sequence = 0;
  pending.records = {};
  pending.conflicts = {};
  for (const receipt of Object.values(pending.receipts)) {
    receipt.status = "pending";
    receipt.checkpoint = null;
    delete receipt.conflictId;
  }
  await receiveSnapshot(state, pending, latest);
  expect(state.accepted?.checkpoint.sequence).toBe(1);
  expect((await projectGroups(state, "observer")).read("note").value).toBe("accepted");
});
