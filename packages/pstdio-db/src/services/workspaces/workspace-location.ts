import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { projects, workspaces } from "../../db/schemas.pg";
import { type JsonObject, nowTimestamp } from "./workspace-record";

export const attachInitialProvider = async (
  db: DbClient,
  id: string,
  input: { provider_id: string; provider_params_json: JsonObject; root_path?: string; provider_operation_id: string },
) => {
  const rows = await db
    .update(workspaces)
    .set({
      ...input,
      provider_state: "provisioning",
      provider_operation_kind: "create",
      updated_at: nowTimestamp(),
    })
    .where(
      and(
        eq(workspaces.id, id),
        eq(workspaces.is_default, true),
        isNull(workspaces.root_path),
        isNull(workspaces.provider_ref_json),
        isNull(workspaces.provider_operation_id),
      ),
    )
    .returning();
  return rows.at(0) ?? null;
};

export const findDefaultByPath = async (db: DbClient, rootPath: string) => {
  const rows = await db
    .select({ workspace: workspaces })
    .from(workspaces)
    .innerJoin(projects, eq(workspaces.project_id, projects.id))
    .where(
      and(
        eq(workspaces.root_path, rootPath),
        eq(workspaces.is_default, true),
        isNull(workspaces.deleted_at),
        isNull(projects.deleted_at),
      ),
    );
  return rows.at(0)?.workspace ?? null;
};
