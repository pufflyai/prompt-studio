import { expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { projects } from "../../db/schemas.pg";
import { clearOwnerDocuments } from "./clear-documents";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { createPersonalHistoryIndex } from "./personal-history-index";

test("private history shares integer ownership and forgets cached data when a project is recreated", async () => {
  const fixture = await createExtensionStorageFixture();
  try {
    const index = createPersonalHistoryIndex(fixture.db);
    const owner = { workbenchId: fixture.projectAId, extensionId: "private-alice" };
    const delta = { deviceId: "laptop", kind: "sessions", id: "same-id", value: { id: "same-id", title: "Saved" } };
    await index.apply(owner, "saved-cursor", [delta]);
    await index.markMigrated(owner);
    await index.accept(owner, "laptop", null, [{ entryId: "accepted-id", sequence: 17, index: 2, delta }]);
    expect(await index.get(owner, "sessions", "same-id")).toEqual(delta.value);
    expect(await index.read(owner, "sessions")).toEqual([delta.value]);
    const rows = await fixture.db.execute<{ id: number; history_cursor: string; history_migrated: boolean }>(sql`
      SELECT owners.id, owners.history_cursor, owners.history_migrated FROM owners
      JOIN history_rows ON history_rows.owner_id=owners.id
      JOIN history_sources ON history_sources.owner_id=owners.id
      WHERE owners.project_id=${owner.workbenchId} AND owners.extension_id=${owner.extensionId}`);
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]).toMatchObject({ history_cursor: "saved-cursor", history_migrated: true });
    await fixture.db.delete(projects).where(eq(projects.id, fixture.projectAId));
    const now = new Date().toISOString();
    await fixture.db
      .insert(projects)
      .values({ id: fixture.projectAId, name: "Recreated", shorthand: "A", created_at: now, updated_at: now });
    expect(await index.get(owner, "sessions", "same-id")).toBeUndefined();
    expect(await index.read(owner, "sessions")).toEqual([]);
    expect(await index.cursor(owner)).toBeNull();
    expect(await index.migrated(owner)).toBe(false);
    await index.apply(owner, null, [{ ...delta, value: { id: "same-id", title: "New history" } }]);
    expect(await index.read(owner, "sessions")).toEqual([{ id: "same-id", title: "New history" }]);
  } finally {
    await fixture.close();
  }
});

test("removing extension data clears private history, cursors and previously cached reads", async () => {
  const fixture = await createExtensionStorageFixture();
  try {
    const index = createPersonalHistoryIndex(fixture.db);
    const owner = { workbenchId: fixture.projectAId, extensionId: "private-alice" };
    await index.apply(owner, "old-cursor", [{ deviceId: "laptop", kind: "sessions", id: "old", value: { id: "old" } }]);
    await index.markMigrated(owner);
    expect(await index.read(owner, "sessions")).toEqual([{ id: "old" }]);
    await fixture.db.transaction((tx) => clearOwnerDocuments(tx, owner));
    expect(await index.read(owner, "sessions")).toEqual([]);
    expect(await index.cursor(owner)).toBeNull();
    expect(await index.migrated(owner)).toBe(false);
  } finally {
    await fixture.close();
  }
});
