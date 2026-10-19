import { expect, test } from "bun:test";
import { type Receipt, sealMutation } from "pstdio-sync-contracts";
import { reconstructSnapshot } from "./replay";
import { conflictedState } from "./sync-state.fixture";

test("replay preserves special-key identities and removes transport proofs from content", async () => {
  const { before } = await conflictedState();
  const base = {
    ...before,
    records: {},
    receipts: {},
    conflicts: {},
    journalSequence: 0,
    checkpoint: { ...before.checkpoint, sequence: 0 },
  };
  const groups: Receipt[] = [];
  for (const [index, id] of ["toString", "constructor", "__proto__"].entries()) {
    const mutation = await sealMutation({
      protocolVersion: 2,
      scope: base.scope,
      epoch: base.checkpoint.epoch,
      generation: base.generation,
      sequence: index + 1,
      environmentId: "writer",
      operationId: id,
      parents: [],
      changes: [{ recordId: id, expectedRevision: 0, baseDeleted: false, deleted: true }],
    });
    groups.push({
      mutation,
      operationId: id,
      fingerprint: mutation.fingerprint,
      status: "accepted",
      order: index + 1,
      checkpoint: { ...base.checkpoint, sequence: index + 1 },
      recoveryProof: "a".repeat(64),
    });
  }
  const { records: _records, receipts: _receipts, checkpoint, ...boundary } = base;
  const reconstructed = await reconstructSnapshot(base, {
    ...boundary,
    after: checkpoint,
    through: { ...checkpoint, sequence: groups.length },
    journalSequence: groups.length,
    groups,
    outstanding: {},
  });
  for (const id of ["toString", "constructor", "__proto__"]) {
    expect(Object.hasOwn(reconstructed.receipts, id)).toBe(true);
    expect(Object.hasOwn(reconstructed.records, id)).toBe(true);
    expect(reconstructed.records[id].deleted).toBe(true);
    expect(reconstructed.receipts[id]).not.toHaveProperty("recoveryProof");
  }
  expect(Object.getPrototypeOf(reconstructed.records)).toBe(Object.prototype);
});
