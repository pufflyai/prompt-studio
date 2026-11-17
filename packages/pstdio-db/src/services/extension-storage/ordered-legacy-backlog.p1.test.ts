import { expect, test } from "bun:test";
import { sql } from "drizzle-orm";
import { createDb } from "../../db/connection.pglite";
import { ensureOrderedOwner } from "./ordered-conversion";
import { backlogOwner, seedLegacyBacklog } from "./ordered-legacy-backlog.fixture";

test("a legacy backlog retains clean and pending tombstones through conversion", async () => {
  const connection = await createDb({ path: ":memory:" });
  try {
    await seedLegacyBacklog(connection.db, 30);
    await ensureOrderedOwner(connection.db, backlogOwner);
    const result = await connection.db.execute(
      sql`SELECT count(*) AS records, count(*) FILTER (WHERE deleted) AS tombstones FROM storage_current_records`,
    );
    expect(result.rows[0]).toEqual({ records: 30, tombstones: 24 });
  } finally {
    await connection.close();
  }
});
