import { and, eq, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import type { ExtensionConnectionCheck } from "../../db/schemas/credentials";
import { preferences } from "../../db/schemas/preferences";
import type { JsonObject } from "../../db/schemas/types";
import { createExtensionCredentialsDBService, credentialProvider } from "./credentials";

interface ConnectionKey {
  projectId: string;
  extensionId: string;
  contributionId: string;
}
export interface ConnectionConfiguration {
  id: string;
  base_url: string;
  auth_type: "bearer" | "header";
  auth_header_name: string | null;
  config_json: JsonObject;
  created_at: string;
}
const whereKey = (input: ConnectionKey) =>
  and(
    eq(preferences.scope, "project"),
    eq(preferences.scope_id, input.projectId),
    eq(preferences.extension_id, input.extensionId),
    eq(preferences.key, `connection:${input.contributionId}`),
  );
const connectionRows = sql`starts_with(${preferences.key}, 'connection:') AND ${preferences.scope} = 'project'`;

export const createExtensionConnectionsDBService = (db: DbClient) => {
  const credentialStore = createExtensionCredentialsDBService(db);
  const fromRow = async (row: typeof preferences.$inferSelect) => {
    const config = row.value as ConnectionConfiguration;
    const key = {
      projectId: row.project_id!,
      extensionId: row.extension_id,
      contributionId: row.key.slice("connection:".length),
    };
    const credential = await credentialStore.resolve(key, credentialProvider(config.base_url));
    return {
      ...config,
      project_id: key.projectId,
      extension_id: key.extensionId,
      contribution_id: key.contributionId,
      secret_ref: credential?.secret_ref ?? null,
      last_check_json: credential?.last_check ?? null,
      credential_project_id: credential?.project_id,
      updated_at: row.updated_at,
    };
  };
  const get = async (key: ConnectionKey) => {
    const [row] = await db.select().from(preferences).where(whereKey(key));
    return row ? fromRow(row) : null;
  };
  const list = async (condition?: ReturnType<typeof eq>) => {
    const rows = await db.select().from(preferences).where(and(connectionRows, condition));
    return Promise.all(rows.map(fromRow));
  };
  const upsert = async (
    input: ConnectionKey & {
      baseUrl: string;
      authType: "bearer" | "header";
      authHeaderName?: string | null;
      secretRef?: string | null;
      credentialProjectId?: string | null;
    },
  ) => {
    await db.transaction(async (tx) => {
      const stamp = new Date().toISOString();
      const value: ConnectionConfiguration = {
        id: crypto.randomUUID(),
        base_url: input.baseUrl,
        auth_type: input.authType,
        auth_header_name: input.authHeaderName ?? null,
        config_json: {},
        created_at: stamp,
      };
      await tx
        .insert(preferences)
        .values({
          scope: "project",
          scope_id: input.projectId,
          project_id: input.projectId,
          extension_id: input.extensionId,
          key: `connection:${input.contributionId}`,
          sync: "team",
          value,
          updated_at: stamp,
        })
        .onConflictDoUpdate({
          target: [preferences.scope, preferences.scope_id, preferences.extension_id, preferences.key],
          set: {
            value: sql`${preferences.value} || ${JSON.stringify({ base_url: value.base_url, auth_type: value.auth_type, auth_header_name: value.auth_header_name })}::jsonb`,
            updated_at: stamp,
          },
        });
      const store = createExtensionCredentialsDBService(tx);
      if (input.secretRef) {
        const projectId = input.credentialProjectId === undefined ? input.projectId : input.credentialProjectId;
        await store.upsert({
          ...input,
          projectId,
          secretRef: input.secretRef,
          provider: credentialProvider(input.baseUrl),
        });
        if (projectId === null) await store.remove(input);
      }
    });
    return (await get(input))!;
  };
  return {
    credentials: credentialStore,
    get,
    upsert,
    listByProject: (projectId: string) => list(eq(preferences.project_id, projectId)),
    listAll: () => list(),
    listByExtension: (projectId: string, extensionId: string) =>
      list(and(eq(preferences.project_id, projectId), eq(preferences.extension_id, extensionId))),
    async remove(input: ConnectionKey, allProjects = false) {
      const existing = await get(input);
      if (!existing) return null;
      await db.transaction(async (tx) => {
        await tx.delete(preferences).where(whereKey(input));
        const store = createExtensionCredentialsDBService(tx);
        await store.remove(input);
        if (allProjects) await store.remove({ ...input, projectId: null });
      });
      return existing;
    },
    async recordCheck(input: ConnectionKey, check: ExtensionConnectionCheck) {
      const row = await get(input);
      if (row?.secret_ref)
        await credentialStore.recordCheck({ ...input, projectId: row.credential_project_id ?? null }, check);
    },
  };
};
