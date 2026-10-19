import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { createGroupedStorageDBService } from "./grouped-storage";

test("frozen writer positions keep retry digests across database reopen and restore", async () => {
  const root = await mkdtemp(join(tmpdir(), "grouped-writer-position-"));
  const path = join(root, "database");
  let database = await createDb({ path });
  const owner = { workbenchId: "workbench", extensionId: "notes" };
  try {
    const now = new Date().toISOString();
    await database.db.insert(projects).values({
      id: owner.workbenchId,
      name: "Notes",
      shorthand: "N",
      created_at: now,
      updated_at: now,
    });
    let service = createGroupedStorageDBService(database.db);
    let local = service.open({ owner, environmentId: "writer" });
    await service.transaction(owner, async (state) => {
      state.accepted = {
        protocolVersion: 2,
        generation: 0,
        covered: 0,
        writers: {},
        documents: {},
        retainedBranches: [],
        scope: { ...owner, accountId: "account" },
        journalSequence: 0,
        checkpoint: { epoch: "original", sequence: 0 },
        records: {},
        receipts: {},
        conflicts: {},
        publishedRevision: "published",
      };
    });
    await local.records.commit({
      operationId: "first",
      edits: [{ recordId: "note", expectedRevision: (await local.records.read("note")).revision, replace: "saved" }],
    });
    const frozen = await local.mutation("first");
    expect(await service.transaction(owner, async (state) => state.journal[0].mutation.position)).toEqual({
      epoch: frozen.epoch,
      generation: frozen.generation,
      sequence: frozen.sequence,
    });
    await database.close();
    database = await createDb({ path });
    service = createGroupedStorageDBService(database.db);
    local = service.open({ owner, environmentId: "writer" });
    await service.transaction(owner, async (state) => {
      state.accepted = { ...state.accepted!, generation: 1, checkpoint: { epoch: "restored", sequence: 0 } };
    });
    expect(await local.mutation("first")).toEqual(frozen);
    await local.records.commit({
      operationId: "second",
      edits: [{ recordId: "note", expectedRevision: (await local.records.read("note")).revision, replace: "next" }],
    });
    const next = await local.mutation("second");
    expect(next.sequence).toBeGreaterThan(frozen.sequence);
    expect(next.epoch).toBe("restored");
    expect(next.generation).toBe(1);
  } finally {
    await database.close();
    await rm(root, { recursive: true, force: true });
  }
});
