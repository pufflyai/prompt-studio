import { expect, test } from "bun:test";
import { sealOperation } from "./journal";
import { conflictedState } from "./sync-state.fixture";

test("a frozen retry keeps its writer position and digest after restore or generation change", async () => {
  const { state } = await conflictedState();
  const operation = {
    operationId: "new",
    environmentId: "writer",
    parents: [],
    changes: [{ recordId: "new", expectedRevision: 0, baseDeleted: false, deleted: true }],
  };
  state.journal.push({ inputFingerprint: "input", mutation: operation });
  const first = await sealOperation(state, operation);
  state.accepted = { ...state.accepted!, generation: 1, checkpoint: { epoch: "restored", sequence: 0 } };
  expect(await sealOperation(state, operation)).toEqual(first);
  const next = { ...operation, operationId: "next", position: undefined };
  state.journal.push({ inputFingerprint: "next", mutation: next });
  const second = await sealOperation(state, next);
  expect(second.sequence).toBeGreaterThan(first.sequence);
  expect(second.epoch).toBe("restored");
  expect(second.generation).toBe(1);
});
