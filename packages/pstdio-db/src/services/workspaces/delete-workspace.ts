import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { workspaces } from "../../db/schemas.pg";
import { hostResourceRef, workspaceColumns } from "../legacy-resource-links";
import { createResourceLinksDBService } from "../resource-links";
import { nowTimestamp } from "./workspace-record";

export const softDeleteWorkspace = (db: DbClient, id: string, options?: { forget?: boolean }) =>
  db.transaction(async (tx) => {
    const timestamp = nowTimestamp();
    const [row] = await tx
      .update(workspaces)
      .set({ deleted_at: timestamp, archived: true, updated_at: timestamp })
      .where(
        and(
          eq(workspaces.id, id),
          isNull(workspaces.deleted_at),
          ...(options?.forget
            ? [
                eq(workspaces.is_default, false),
                eq(workspaces.provider_state, "provider_missing"),
                eq(workspaces.execution_kind, "remote"),
                isNull(workspaces.provider_ref_json),
                isNull(workspaces.root_path),
              ]
            : []),
        ),
      )
      .returning(workspaceColumns);
    if (!row) return null;
    const changes = await createResourceLinksDBService(tx).removeResource(hostResourceRef("workspace", row));
    return { workspace: row, changes };
  });
