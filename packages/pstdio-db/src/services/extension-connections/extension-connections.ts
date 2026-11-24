import { and, eq, isNull } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import type { ExtensionConnectionCheck } from "../../db/schemas/extension-connections";
import { extension_connections } from "../../db/schemas.pg";
import { createGlobalConnectionsStore } from "./global-connections";

const nowTimestamp = () => new Date().toISOString();

type ConnectionKey = {
  projectId: string | null;
  extensionId: string;
  contributionId: string;
};

export const createExtensionConnectionsDBService = (db: DbClient) => {
  const global = createGlobalConnectionsStore(db);
  const whereKey = (input: ConnectionKey) =>
    and(
      input.projectId === null
        ? isNull(extension_connections.project_id)
        : eq(extension_connections.project_id, input.projectId),
      eq(extension_connections.extension_id, input.extensionId),
      eq(extension_connections.contribution_id, input.contributionId),
    );

  const get = async (input: ConnectionKey) => {
    if (input.projectId === null) return global.get(input.extensionId, input.contributionId);
    const [row] = await db.select().from(extension_connections).where(whereKey(input));
    return row ?? null;
  };

  const listByProject = (projectId: string) =>
    db.select().from(extension_connections).where(eq(extension_connections.project_id, projectId));

  const listAll = async () => [...(await db.select().from(extension_connections)), ...(await global.list())];
  const listGlobal = () => global.list();

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
    if (input.projectId === null) {
      const existing = await global.get(input.extensionId, input.contributionId);
      return global.set({
        ...row,
        project_id: null,
        id: existing?.id ?? row.id,
        created_at: existing?.created_at ?? timestamp,
      });
    }
    const [stored] = await db
      .insert(extension_connections)
      .values({ ...row, project_id: input.projectId })
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
    if (input.projectId === null) return global.remove(input.extensionId, input.contributionId);
    const [deleted] = await db.delete(extension_connections).where(whereKey(input)).returning();
    return deleted ?? null;
  };

  const recordCheck = async (input: ConnectionKey, check: ExtensionConnectionCheck) => {
    if (input.projectId === null) {
      await global.recordCheck(input.extensionId, input.contributionId, check);
      return;
    }
    await db.update(extension_connections).set({ last_check_json: check }).where(whereKey(input));
  };

  return { get, listGlobal, listAll, listByExtension, listByProject, recordCheck, remove, upsert };
};
