import { eq, sql } from "drizzle-orm";
import type { DbClient } from "./connection.pglite";
import { board_views } from "./schemas.pg";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

export const releasedBoardExtension = async (db: DbClient, projectId: string, instanceId: string | null) => {
  if (instanceId === null) return null;
  const {
    rows: [owner],
  } = await db.execute<{ extension_id: string }>(sql`
    SELECT s.extension_id FROM extension_instances i
    JOIN installed_extension_sources s ON s.id = i.installed_extension_id
    WHERE i.id = ${instanceId} AND i.scope_type = 'project' AND i.scope_id = ${projectId}
  `);
  if (!owner) throw new Error(`Board extension instance does not belong to project: ${instanceId}`);
  return owner.extension_id;
};
export const prepareBoardOwnersUpgrade = async (db: DbClient, path: string) => {
  const {
    rows: [legacy],
  } = await db.execute<{ present: boolean }>(sql`
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
      AND table_name = 'board_views' AND column_name = 'extension_instance_id') AS present
  `);
  return prepareUpgradeSnapshot(
    db,
    path,
    {
      table: "board_views",
      keys: ["id"],
      name: "board-owners",
      archive: "board-owners",
      capture: legacy.present,
    },
    async (row) => {
      await db
        .update(board_views)
        .set({ extension_id: row.extension_id as string | null })
        .where(eq(board_views.id, row.id as string));
    },
    async (row) => ({
      ...row,
      extension_id: await releasedBoardExtension(
        db,
        row.project_id as string,
        row.extension_instance_id as string | null,
      ),
    }),
  );
};
