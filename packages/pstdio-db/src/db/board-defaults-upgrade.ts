import { type BoardDefault, setBoardDefault } from "../services/board-views/board-defaults";
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
      nullableKeys: ["extension_instance_id"],
    },
    async (input) => {
      const row = input as BoardDefault;
      await db.transaction((tx) => setBoardDefault(tx, row, row.default_view_id, row.updated_at));
    },
  );
