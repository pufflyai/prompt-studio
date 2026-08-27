import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import type { ExtensionConnectionCheck } from "../../db/schemas/extension-connections";
import { extension_connections } from "../../db/schemas.pg";

const nowTimestamp = () => new Date().toISOString();

type ConnectionKey = {
  projectId: string;
  extensionId: string;
  contributionId: string;
};

export const createExtensionConnectionsDBService = (db: DbClient) => {
  const whereKey = (input: ConnectionKey) =>
    and(
      eq(extension_connections.project_id, input.projectId),
      eq(extension_connections.extension_id, input.extensionId),
      eq(extension_connections.contribution_id, input.contributionId),
    );

  const get = async (input: ConnectionKey) => {
    const [row] = await db.select().from(extension_connections).where(whereKey(input));
    return row ?? null;
  };

  const listByProject = (projectId: string) =>
    db.select().from(extension_connections).where(eq(extension_connections.project_id, projectId));

  const listAll = () => db.select().from(extension_connections);

  const listByExtension = (projectId: string, extensionId: string) =>
    db
      .select()
      .from(extension_connections)
      .where(and(eq(extension_connections.project_id, projectId), eq(extension_connections.extension_id, extensionId)));

  const upsert = async (
    input: ConnectionKey & {
      baseUrl: string;
      authType: "bearer" | "header";
      authHeaderName?: string | null;
      secretRef?: string | null;
    },
  ) => {
    const timestamp = nowTimestamp();
    const row = {
      id: crypto.randomUUID(),
      project_id: input.projectId,
      extension_id: input.extensionId,
      contribution_id: input.contributionId,
      base_url: input.baseUrl,
      auth_type: input.authType,
      auth_header_name: input.authHeaderName ?? null,
      secret_ref: input.secretRef ?? null,
      config_json: {},
      last_check_json: null,
      created_at: timestamp,
      updated_at: timestamp,
    };
    const [stored] = await db
      .insert(extension_connections)
      .values(row)
      .onConflictDoUpdate({
        target: [
          extension_connections.project_id,
          extension_connections.extension_id,
          extension_connections.contribution_id,
        ],
        set: {
          base_url: row.base_url,
          auth_type: row.auth_type,
          auth_header_name: row.auth_header_name,
          secret_ref: row.secret_ref,
          updated_at: timestamp,
        },
      })
      .returning();
    return stored;
  };

  const remove = async (input: ConnectionKey) => {
    const [deleted] = await db.delete(extension_connections).where(whereKey(input)).returning();
    return deleted ?? null;
  };

  const recordCheck = (input: ConnectionKey, check: ExtensionConnectionCheck) =>
    db.update(extension_connections).set({ last_check_json: check }).where(whereKey(input));

  return { get, listAll, listByExtension, listByProject, recordCheck, remove, upsert };
};
