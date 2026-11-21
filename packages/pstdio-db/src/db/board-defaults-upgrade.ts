import { type BoardDefault, getBoardDefault, setBoardDefault } from "../services/board-views/board-defaults";
import { releasedBoardExtension } from "./board-owners-upgrade";
import type { DbClient } from "./connection.pglite";
import { prepareUpgradeSnapshot } from "./upgrade-snapshot";

export const prepareBoardDefaultsUpgrade = (db: DbClient, path: string) =>
  prepareUpgradeSnapshot(
    db,
    path,
    {
      table: "board_default_views",
      keys: ["project_id", "extension_instance_id", "board_id"],
      name: "board-defaults",
      archive: "board-defaults",
      nullableKeys: ["extension_instance_id"],
    },
    async (input) => {
      const row = input as BoardDefault;
      const scope = { project_id: row.project_id, extension_id: row.extension_id, board_id: row.board_id };
      await db.transaction(async (tx) => {
        const previous = await getBoardDefault(tx, scope);
        if (previous && previous.updated_at > row.updated_at) return;
        await setBoardDefault(tx, scope, row.default_view_id, row.updated_at);
      });
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
