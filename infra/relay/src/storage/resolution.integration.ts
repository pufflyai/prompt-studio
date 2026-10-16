import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { fingerprint, type Mutation, type Scope, type Snapshot, sealMutation } from "pstdio-sync-contracts";
import { createRelayStorage, migrateRelayStorage } from "./storage";

const databaseUrl = process.env.SYNC_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("Run through the isolated conformance runner");

const edit = async (
  scope: Scope,
  value: string,
  revision: number,
  base: string | null,
  resolution?: Mutation["resolution"],
) =>
  sealMutation({
    protocolVersion: 1,
    scope,
    environmentId: value,
    operationId: crypto.randomUUID(),
    parents: resolution?.capturedOperationIds ?? [],
    resolution,
    changes: [
      {
        recordId: "note",
        expectedRevision: revision,
        baseDeleted: false,
        value: { expected: await fingerprint(base), next: value },
      },
    ],
  });

const proposal = (snapshot: Snapshot, root: string, captured: string[]) => ({
  conflictId: root,
  capturedOperationIds: captured,
  expectedInputs: [{ recordId: "note", revision: snapshot.records.note.revision }],
  expectedConflicts: Object.values(snapshot.conflicts)
    .filter((conflict) => conflict.alternativeOperationIds.some((id) => captured.includes(id)))
    .map((conflict) => ({ conflictId: conflict.conflictId, revision: conflict.revision })),
});

test("resolving a retained alternative cannot reopen a proposal consumed by an earlier resolution", async () => {
  await migrateRelayStorage(databaseUrl, resolve(import.meta.dir, "../../drizzle"));
  const storage = createRelayStorage(databaseUrl, { complete: async () => true });
  const scope = { accountId: "owner", workbenchId: crypto.randomUUID(), extensionId: "notes" };
  const owner = await storage.initialize(scope, "published-1");
  try {
    expect((await owner.submit(await edit(scope, "base", 0, null))).status).toBe("accepted");
    const root = await edit(scope, "branch", 0, null);
    expect((await owner.submit(root)).status).toBe("conflict");
    const initial = await owner.snapshot();
    const captured = [root.operationId];
    const rejected = await edit(scope, "first proposal", 1, "base", proposal(initial, root.operationId, captured));
    const other = await edit(scope, "other proposal", 1, "base", proposal(initial, root.operationId, captured));
    expect((await owner.submit(await edit(scope, "new accepted", 1, "base"))).status).toBe("accepted");
    expect((await owner.submit(rejected)).status).toBe("conflict");
    expect((await owner.submit(other)).status).toBe("conflict");
    const before = await owner.snapshot();
    const replacement = await edit(
      scope,
      "chosen first branch",
      2,
      "new accepted",
      proposal(before, root.operationId, [root.operationId, rejected.operationId]),
    );
    expect((await owner.submit(replacement)).status).toBe("accepted");
    const retained = await owner.snapshot();
    expect(retained.conflicts[other.operationId].resolvedBy).toBeUndefined();
    const final = await edit(
      scope,
      "chosen other branch",
      3,
      "chosen first branch",
      proposal(retained, other.operationId, [root.operationId, other.operationId]),
    );
    expect((await owner.submit(final)).status).toBe("accepted");
    const saved = await owner.snapshot();
    expect(saved.conflicts[rejected.operationId]).toBeUndefined();
    expect(Object.values(saved.conflicts).filter((conflict) => !conflict.resolvedBy)).toHaveLength(0);
    expect(saved.records.note.value).toBe("chosen other branch");
  } finally {
    await storage.close();
  }
});
