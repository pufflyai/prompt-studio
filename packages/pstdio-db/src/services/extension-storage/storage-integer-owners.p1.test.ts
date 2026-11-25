import { expect, test } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { projects } from "../../db/schemas.pg";
import { createExtensionStorageFixture } from "./extension-storage.fixture";
import { createOrderedLogStore } from "./ordered-log-store";

// The physical key is part of the storage contract: payloads and every entry index
// must stop repeating the five text address columns as a project grows.
test("logs share one integer owner, isolate streams and resolve a recreated project without stale ids", async () => {
  const fixture = await createExtensionStorageFixture();
  try {
    const address = {
      owner: { workbenchId: fixture.projectAId, extensionId: "ext.example" },
      name: "activity",
      scope: "project",
      stream: "device-a",
      writerId: "device-a",
    };
    const first = createOrderedLogStore(fixture.db, address);
    const second = createOrderedLogStore(fixture.db, { ...address, name: "changes" });
    const other = createOrderedLogStore(fixture.db, {
      ...address,
      owner: { ...address.owner, workbenchId: fixture.projectBId },
    });
    await first.append({ message: "first" }, { id: "same-id" });
    await second.append({ message: "second" }, { id: "same-id" });
    await other.append({ message: "other project" }, { id: "same-id" });
    const keys = await fixture.db.execute<{ owner_id: number; stream_id: string; entry_id: string }>(sql`
      SELECT owners.id AS owner_id, log_streams.id AS stream_id, log_entries.entry_id
      FROM owners JOIN log_streams ON log_streams.owner_id = owners.id
      JOIN log_entries ON log_entries.stream_id = log_streams.id
      WHERE owners.project_id = ${fixture.projectAId}
      ORDER BY log_streams.id
    `);
    expect(keys.rows).toHaveLength(2);
    expect(Number.isInteger(keys.rows[0]!.owner_id)).toBe(true);
    expect(keys.rows[0]!.owner_id).toBe(keys.rows[1]!.owner_id);
    expect(keys.rows[0]!.stream_id).not.toBe(keys.rows[1]!.stream_id);
    expect((await first.read({ after: 0, limit: 10 })).entries.map((entry) => entry.value)).toEqual([
      { message: "first" },
    ]);
    expect((await second.read({ after: 0, limit: 10 })).entries.map((entry) => entry.value)).toEqual([
      { message: "second" },
    ]);

    await fixture.db.delete(projects).where(eq(projects.id, fixture.projectAId));
    expect((await first.read({ after: 0, limit: 10 })).entries).toEqual([]);
    expect((await other.read({ after: 0, limit: 10 })).entries).toHaveLength(1);
    const now = new Date().toISOString();
    await fixture.db.insert(projects).values({
      id: fixture.projectAId,
      name: "Recreated",
      shorthand: "A",
      created_at: now,
      updated_at: now,
    });
    await first.append({ message: "recreated" }, { id: "same-id" });
    const recreated = await fixture.db.execute<{ id: number }>(
      sql`SELECT id FROM owners WHERE project_id = ${fixture.projectAId} AND extension_id = 'ext.example'`,
    );
    expect(recreated.rows[0]!.id).not.toBe(keys.rows[0]!.owner_id);
    expect((await first.read({ after: 0, limit: 10 })).entries.map((entry) => entry.value)).toEqual([
      { message: "recreated" },
    ]);
  } finally {
    await fixture.close();
  }
});
