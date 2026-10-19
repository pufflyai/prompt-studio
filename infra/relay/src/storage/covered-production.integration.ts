import { afterAll, beforeAll, expect, test } from "bun:test";
import { resolve } from "node:path";
import { createRecordStorage, type GroupedState, reconstructSnapshot } from "pstdio-sync";
import { fingerprint, type Scope, sealMutation, snapshotFingerprint } from "pstdio-sync-contracts";
import { createRelayStorage, migrateRelayStorage } from "./storage";

const url = process.env.SYNC_TEST_DATABASE_URL!;
let storage: ReturnType<typeof createRelayStorage>;
beforeAll(async () => {
  if (!url) throw new Error("Use the isolated storage runner");
  await migrateRelayStorage(url, resolve(import.meta.dir, "../../drizzle"));
  storage = createRelayStorage(url, { complete: async () => true });
});
afterAll(async () => storage?.close());

test("production snapshots cover durable generic groups without acknowledging pending work", async () => {
  const scope: Scope = { accountId: "owner", workbenchId: crypto.randomUUID(), extensionId: "records" };
  const owner = await storage.initialize(scope, "published-1");
  const initial = await owner.snapshot();
  const group = await sealMutation({
    protocolVersion: 2,
    scope,
    epoch: initial.checkpoint.epoch,
    generation: initial.generation,
    environmentId: "writer",
    sequence: 1,
    operationId: "ordinary",
    parents: [],
    changes: [
      {
        recordId: "scalar",
        expectedRevision: 0,
        baseDeleted: false,
        value: { expected: await fingerprint(null), next: "durable" },
      },
    ],
  });
  const receipt = await owner.submit(group);
  expect(receipt.status).toBe("accepted");
  expect(await owner.submit(group)).toEqual(receipt);
  const beforeTail = await owner.capture();
  const conflict = await sealMutation({ ...group, operationId: "conflicting", sequence: 2 });
  expect((await owner.submit(conflict)).status).toBe("conflict");
  const pending = await sealMutation({ ...group, operationId: "pending", sequence: 3, parents: ["conflicting"] });
  expect((await owner.submit(pending)).status).toBe("pending");
  const tail = await owner.replay(beforeTail.snapshot.checkpoint);
  if (tail.status !== "replay") throw new Error("Expected an uncovered tail");
  expect(tail.batch.outstanding.conflicting.status).toBe("conflict");
  expect(tail.batch.outstanding.pending.status).toBe("pending");
  expect(tail.batch.conflicts.conflicting.alternativeOperationIds).toContain("conflicting");
  const captured = await owner.capture();
  expect(captured.snapshot.protocolVersion).toBe(2);
  expect(captured.snapshot.checkpoint.sequence).toBe(1);
  expect(captured.snapshot.covered).toBe(0);
  expect(captured.snapshot.writers).toEqual({ writer: { floor: 0 } });
  expect(captured.snapshot.documents).toEqual({});
  expect(captured.snapshot.receipts.pending.checkpoint).toBeNull();
  expect(captured.snapshot.retainedBranches).toContain("pending");
  expect(captured.snapshotHash).toBe(await fingerprint(captured.snapshot));
  expect(await reconstructSnapshot(beforeTail.snapshot, tail.batch)).toEqual(captured.snapshot);
  const ack = {
    protocolVersion: 2 as const,
    scope,
    epoch: captured.snapshot.checkpoint.epoch,
    generation: captured.snapshot.generation,
    environmentId: "writer",
    cut: 1,
    snapshotHash: await snapshotFingerprint(captured.snapshot),
    branches: ["conflicting", "pending"],
    recovery: [],
  };
  await expect(owner.acknowledge({ ...ack, cut: 3 }, "writer")).rejects.toThrow("exact installed snapshot");
  expect(await owner.acknowledge({ ...ack, snapshotHash: "0".repeat(64) }, "writer")).toEqual({
    status: "snapshot-required",
  });
  await expect(owner.acknowledge(ack, "other")).rejects.toThrow("exact installed snapshot");
  expect(await owner.acknowledge(ack, "writer")).toEqual({ status: "acknowledged", acknowledgement: ack });
  expect((await owner.snapshot()).covered).toBe(0);
  await storage.close();
  storage = createRelayStorage(url, { complete: async () => true });
  expect(await storage.owner(scope).submit(group)).toEqual(receipt);
  await expect(
    storage
      .owner(scope)
      .submit(await sealMutation({ ...group, operationId: "stale", sequence: 3, generation: initial.generation + 1 })),
  ).rejects.toThrow("Resynchronization required");
  await expect(storage.owner({ ...scope, accountId: "other" }).submit(group)).rejects.toThrow("scope");
});

test("optional document checkpoints persist their real generation and recovery revision", async () => {
  const scope = { accountId: "owner", workbenchId: crypto.randomUUID(), extensionId: "documents" };
  const owner = await storage.initialize(scope, "published-1");
  const snapshot = await owner.snapshot();
  const state: GroupedState = { owner: scope, accepted: null, journal: [] };
  const local = createRecordStorage({
    owner: scope,
    environmentId: "writer",
    store: { transaction: async (_owner, action) => action(state) },
  });
  await local.records.commit({
    operationId: "document",
    edits: [
      {
        recordId: "toString",
        expectedRevision: (await local.records.read("toString")).revision,
        shared: [{ kind: "text.insert", index: 0, text: "real delta" }],
      },
    ],
  });
  const group = await sealMutation({
    protocolVersion: 2,
    scope,
    epoch: snapshot.checkpoint.epoch,
    generation: snapshot.generation,
    environmentId: "writer",
    sequence: 1,
    operationId: "document",
    parents: [],
    document: { recordId: "toString", generation: 0, recoveryRevision: 7 },
    changes: state.journal[0].mutation.changes,
  });
  expect((await owner.submit(group)).status).toBe("accepted");
  const captured = await owner.capture();
  expect(captured.snapshot.documents).toEqual({ toString: 0 });
  expect(captured.snapshot.receipts.document.mutation.document?.recoveryRevision).toBe(7);
  await expect(
    owner.submit(
      await sealMutation({
        ...group,
        operationId: "stale-doc",
        sequence: 2,
        document: { ...group.document!, generation: 1 },
      }),
    ),
  ).rejects.toThrow("Resynchronization required");
});
