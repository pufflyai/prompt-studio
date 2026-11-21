import { eq } from "drizzle-orm";
import { boardDefaultSyncRow, boardViewSyncRow } from "pstdio-api-contracts";
import { board_views, createBoardViewsDBService, type DbClient } from "pstdio-db";
import type { EventBus } from "../sync/event-bus";

/** Runtime identity recovery must update clients that already hold the old scope. */
export const publishBoardOwnerRename = async (
  db: DbClient,
  eventBus: EventBus,
  change: { from: string; to: string },
) => {
  const views = await db.select().from(board_views).where(eq(board_views.extension_id, change.to));
  const defaults = await createBoardViewsDBService(db).listDefaults(undefined, change.to);
  for (const view of views) eventBus.emit("board_views", "set", boardViewSyncRow(view));
  for (const row of defaults)
    eventBus.emit("board_default_views", "delete", {
      id: boardDefaultSyncRow({ ...row, extension_id: change.from }).id,
    });
  for (const row of defaults) eventBus.emit("board_default_views", "set", boardDefaultSyncRow(row));
};
