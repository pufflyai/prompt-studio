import { expect, test } from "bun:test";
import { fingerprint, sealMutation, validateMutation } from "./fingerprint";
import { coveredReceiptSchema } from "./retention";

const scope = { accountId: "account", workbenchId: "workbench", extensionId: "catalog" };

test("ordinary protocol 2 receipts seal writer identity without inventing document facts", async () => {
  const group = await sealMutation({
    protocolVersion: 2,
    scope,
    epoch: "restore-epoch",
    generation: 0,
    environmentId: "writer",
    sequence: 1,
    operationId: "publish-package",
    parents: [],
    changes: [
      {
        recordId: "extension",
        expectedRevision: 0,
        baseDeleted: false,
        value: { expected: await fingerprint(null), next: { revision: "immutable" } },
      },
    ],
  });
  expect(coveredReceiptSchema.parse({ group, status: "accepted", cut: 1 }).group).toEqual(group);
  expect(group).not.toHaveProperty("document");
  await expect(validateMutation({ ...group, generation: 1 })).rejects.toThrow("fingerprint");
  await expect(validateMutation({ ...group, protocolVersion: 1 })).rejects.toThrow();
});

test("a document checkpoint on a generic group must include its real document delta", async () => {
  await expect(
    sealMutation({
      protocolVersion: 2,
      scope,
      epoch: "restore-epoch",
      generation: 0,
      environmentId: "writer",
      sequence: 1,
      operationId: "checkpoint",
      parents: [],
      document: { recordId: "doc", generation: 0, recoveryRevision: 4 },
      changes: [
        {
          recordId: "scalar",
          expectedRevision: 0,
          baseDeleted: false,
          value: { expected: await fingerprint(null), next: 1 },
        },
      ],
    }),
  ).rejects.toThrow("document delta");
});

test("snapshot coverage cannot claim future receipts, a foreign scope, or a future covered cut", async () => {
  const { snapshotSchema } = await import("./state");
  const mutation = await sealMutation({
    protocolVersion: 2,
    scope,
    epoch: "epoch",
    generation: 0,
    environmentId: "writer",
    sequence: 1,
    operationId: "group",
    parents: [],
    changes: [{ recordId: "record", expectedRevision: 0, baseDeleted: false, deleted: true }],
  });
  const checkpoint = { epoch: "epoch", sequence: 1 };
  const snapshot = {
    protocolVersion: 2,
    scope,
    generation: 0,
    covered: 0,
    writers: { writer: { floor: 0 } },
    documents: {},
    retainedBranches: [],
    journalSequence: 1,
    checkpoint,
    records: {},
    conflicts: {},
    publishedRevision: "published",
    receipts: {
      group: {
        operationId: "group",
        fingerprint: mutation.fingerprint,
        mutation,
        status: "accepted",
        checkpoint,
        order: 1,
      },
    },
  };
  expect(snapshotSchema.safeParse(snapshot).success).toBe(true);
  expect(snapshotSchema.safeParse({ ...snapshot, checkpoint: { ...checkpoint, sequence: 0 } }).success).toBe(false);
  expect(snapshotSchema.safeParse({ ...snapshot, scope: { ...scope, accountId: "foreign" } }).success).toBe(false);
  expect(snapshotSchema.safeParse({ ...snapshot, covered: 2 }).success).toBe(false);
});
