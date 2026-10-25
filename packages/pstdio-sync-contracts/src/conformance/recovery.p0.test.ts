import { expect, test } from "bun:test";
import { sealMutation } from "../fingerprint";
import { recoverMissingAcceptedWork } from "./recovery";
import { emptySnapshot } from "./relay";

async function acceptedWork() {
  const scope = { accountId: "a", workbenchId: "w", extensionId: "x" };
  const mutation = await sealMutation({
    protocolVersion: 1,
    scope,
    environmentId: "e",
    operationId: "operation",
    parents: [],
    changes: [{ recordId: "record", expectedRevision: 0, baseDeleted: false, deleted: true }],
  });
  const accepted = emptySnapshot(scope);
  accepted.receipts.operation = {
    order: 1,
    operationId: mutation.operationId,
    mutation,
    fingerprint: mutation.fingerprint,
    status: "accepted",
    checkpoint: { epoch: "e", sequence: 1 },
  };
  return { accepted, pending: [], blobs: {} };
}

test("a rolled-back receipt outcome cannot acknowledge newer accepted local work", async () => {
  for (const status of ["pending", "conflict"] as const) {
    const state = await acceptedWork();
    const restored = structuredClone(state.accepted);
    restored.receipts.operation.status = status;
    restored.receipts.operation.checkpoint = null;
    recoverMissingAcceptedWork(state, restored);
    expect(state.pending).toHaveLength(1);
  }
});

test("an incoming reused identity cannot acknowledge a different local fingerprint", async () => {
  const state = await acceptedWork();
  const incoming = structuredClone(state.accepted);
  incoming.receipts.operation.fingerprint = "f".repeat(64);
  expect(() => recoverMissingAcceptedWork(state, incoming)).toThrow("fingerprint");
});
