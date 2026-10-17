import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { createGroupedStorageDBService } from "./grouped-storage";

test("journal replay evidence survives accepted-snapshot replacement and database reopen", async () => {
  const root = await mkdtemp(join(tmpdir(), "grouped-recovery-proof-"));
  const path = join(root, "database");
  let database = await createDb({ path });
  const owner = { workbenchId: "workbench", extensionId: "notes" };
  try {
    const now = new Date().toISOString();
    await database.db
      .insert(projects)
      .values({ id: owner.workbenchId, name: "Notes", shorthand: "N", created_at: now, updated_at: now });
    let service = createGroupedStorageDBService(database.db);
    const local = service.open({ owner, environmentId: "writer" });
    await local.records.commit({
      operationId: "saved",
      edits: [{ recordId: "note", expectedRevision: (await local.records.read("note")).revision, replace: "saved" }],
    });
    await service.transaction(owner, async (state) => {
      state.journal[0].recoveryProof = "a".repeat(64);
      state.accepted = {
        protocolVersion: 1,
        scope: { ...owner, accountId: "account" },
        journalSequence: 0,
        checkpoint: { epoch: "before-restore", sequence: 0 },
        records: {},
        receipts: {},
        conflicts: {},
        publishedRevision: "published",
      };
    });
    await database.close();
    database = await createDb({ path });
    service = createGroupedStorageDBService(database.db);
    expect(await service.transaction(owner, async (state) => state.journal[0].recoveryProof)).toBe("a".repeat(64));
    await service.transaction(owner, async (state) => {
      state.accepted = null;
      state.journal[0].recoveryProof = "b".repeat(64);
    });
    await database.close();
    database = await createDb({ path });
    expect(
      await createGroupedStorageDBService(database.db).transaction(
        owner,
        async (state) => state.journal[0].recoveryProof,
      ),
    ).toBe("b".repeat(64));
  } finally {
    await database.close();
    await rm(root, { recursive: true, force: true });
  }
});
