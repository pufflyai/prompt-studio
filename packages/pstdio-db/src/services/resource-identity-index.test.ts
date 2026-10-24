import { expect, test } from "bun:test";
import { coreOwnerId, rememberResourceNumber, resourceNumbers } from "pstdio-sync";
import { createDb } from "../db/connection.pglite";
import {
  storage_resource_aliases as aliases,
  storage_resource_identities as identities,
  storage_resource_projections as projections,
  storage_documents,
} from "../db/schemas.pg";
import { createExtensionResourceSequencesDBService } from "./extension-resource-sequences";
import { createDocumentStorageDBService } from "./extension-storage/document-storage";
import { createProjectsDBService } from "./projects/projects";

const staleIdentityFixture = async (db: Awaited<ReturnType<typeof createDb>>["db"]) => {
  const project = await createProjectsDBService(db).create({ name: "Older identity writer" });
  const input = { projectId: project.id, extensionId: "example.items", kind: "item", prefix: "IT" };
  const service = createExtensionResourceSequencesDBService(db);
  const changed = await service.allocate(input);
  const removed = await service.allocate(input);
  const oldIdentities = await db.select().from(identities);
  const oldAliases = await db.select().from(aliases);
  const oldProjection = await db.select().from(projections);
  await service.documentStore.transaction(
    { workbenchId: project.id, extensionId: coreOwnerId },
    async ({ document }) => {
      const resources = resourceNumbers(document);
      const updated = { ...resources.get(changed.id)!, value: 10 };
      const added = { ...updated, id: "added-by-old-writer", value: 11 };
      resources.set(changed.id, updated);
      rememberResourceNumber(document, updated);
      resources.delete(removed.id);
      resources.set(added.id, added);
      rememberResourceNumber(document, added);
    },
  );
  // Older hosts save the source document without maintaining these derived tables.
  await db.transaction(async (tx) => {
    await tx.delete(identities);
    await tx.delete(aliases);
    await tx.delete(projections);
    await tx.insert(projections).values(oldProjection);
    await tx.insert(identities).values(oldIdentities);
    await tx.insert(aliases).values(oldAliases);
  });
  return { service, input, changed, removed, oldProjection, oldIdentities, oldAliases };
};

test("allocation cannot stamp an older resource identity projection current", async () => {
  const connection = await createDb({ path: ":memory:" });
  try {
    const { db } = connection;
    const fixture = await staleIdentityFixture(db);
    const source = await db.select().from(storage_documents);
    await expect(fixture.service.allocate(fixture.input)).rejects.toThrow("Resource identity projection is stale");
    expect(await db.select().from(storage_documents)).toEqual(source);
    expect(await db.select().from(projections)).toEqual(fixture.oldProjection);
    expect(await db.select().from(identities)).toEqual(fixture.oldIdentities);
    expect(await db.select().from(aliases)).toEqual(fixture.oldAliases);
    await expect(fixture.service.identity({ ...fixture.input, id: fixture.changed.id })).rejects.toThrow("stale");
  } finally {
    await connection.close();
  }
});

test("startup repairs stale identities and aliases once after an older writer saves", async () => {
  const connection = await createDb({ path: ":memory:" });
  try {
    const fixture = await staleIdentityFixture(connection.db);
    const events: string[] = [];
    const documents = createDocumentStorageDBService(connection.db, undefined, (event) => events.push(event.phase));
    const restarted = createExtensionResourceSequencesDBService(connection.db, documents);
    const values = await restarted.identityMany({
      ...fixture.input,
      ids: [fixture.changed.id, fixture.removed.id, "added-by-old-writer"],
    });
    expect(values.map((value) => value?.shorthand ?? null)).toEqual(["IT-10", null, "IT-11"]);
    expect(values[0]?.aliases).toEqual(["IT-1"]);
    expect((await restarted.findByShorthand({ ...fixture.input, shorthand: "IT-1" })).map((value) => value.id)).toEqual(
      [fixture.changed.id],
    );
    expect(events).toContain("document-loaded");
    const source = await connection.db.select().from(storage_documents);
    events.length = 0;
    const reopened = createExtensionResourceSequencesDBService(connection.db, documents);
    expect(await reopened.identityMany({ ...fixture.input, ids: [fixture.changed.id] })).toEqual([values[0]]);
    expect(events).not.toContain("document-loaded");
    expect(await connection.db.select().from(storage_documents)).toEqual(source);
    expect((await reopened.allocate(fixture.input)).shorthand).toBe("IT-12");
  } finally {
    await connection.close();
  }
});
