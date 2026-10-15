import { expect, test } from "bun:test";
import { sealMutation } from "./fingerprint";
import { replaySchema } from "./replay";
import { receiptSchema } from "./state";

async function batch() {
  const scope = { accountId: "a", workbenchId: "w", extensionId: "x" };
  const mutation = await sealMutation({
    protocolVersion: 1,
    scope,
    environmentId: "e",
    operationId: "o",
    parents: [],
    changes: [{ recordId: "r", expectedRevision: 0, baseDeleted: false, deleted: true }],
  });
  return {
    protocolVersion: 1,
    scope,
    after: { epoch: "e", sequence: 0 },
    through: { epoch: "e", sequence: 1 },
    groups: [
      {
        order: 1,
        operationId: "o",
        fingerprint: mutation.fingerprint,
        mutation,
        status: "accepted",
        checkpoint: { epoch: "e", sequence: 1 },
      },
    ],
  };
}

test("replay batches frame contiguous complete accepted groups within one epoch and scope", async () => {
  const value = await batch();
  expect(replaySchema.safeParse(value).success).toBe(true);
  expect(replaySchema.safeParse({ ...value, through: { epoch: "other", sequence: 1 } }).success).toBe(false);
  expect(replaySchema.safeParse({ ...value, through: { epoch: "e", sequence: 2 } }).success).toBe(false);
  expect(replaySchema.safeParse({ ...value, groups: [] }).success).toBe(false);
  expect(replaySchema.safeParse({ ...value, scope: { ...value.scope, extensionId: "other" } }).success).toBe(false);
});

test("receipts cannot acknowledge a different identity, digest, or checkpoint outcome", async () => {
  const receipt = (await batch()).groups[0];
  expect(receiptSchema.safeParse({ ...receipt, operationId: "other" }).success).toBe(false);
  expect(receiptSchema.safeParse({ ...receipt, fingerprint: "f".repeat(64) }).success).toBe(false);
  expect(receiptSchema.safeParse({ ...receipt, checkpoint: null }).success).toBe(false);
  expect(receiptSchema.safeParse({ ...receipt, status: "conflict" }).success).toBe(false);
});
