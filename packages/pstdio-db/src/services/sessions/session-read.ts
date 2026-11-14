import { eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { sessions } from "../../db/schemas.pg";
import { historyAnchorProjection, sessionColumns } from "../legacy-resource-links";

export const createSessionRead =
  (db: DbClient) =>
  async (id: string, options: { includeIncomingAnchors?: boolean } = {}) => {
    const [row] = await db
      .select({
        ...sessionColumns,
        ...(options.includeIncomingAnchors ? { anchors_json: historyAnchorProjection(sessions, "session") } : {}),
      })
      .from(sessions)
      .where(eq(sessions.id, id));
    return row ?? null;
  };
