import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import type { ExtensionConnectionCheck } from "../../db/schemas/credentials";
import { preferences } from "../../db/schemas/preferences";
import type { JsonObject } from "../../db/schemas/types";
import {
  type CredentialKey,
  createExtensionCredentialsDBService,
  credentialProvider,
  sharedCredentialKey,
} from "./credentials";

type ConnectionKey = CredentialKey;
export interface ConnectionConfiguration {
  id: string;
  base_url: string;
  auth_type: "bearer" | "header";
  auth_header_name: string | null;
  config_json: JsonObject;
  created_at: string;
}
export const connectionPreference = ({ projectId, extensionId, contributionId }: ConnectionKey) => ({
  scope: projectId === null ? ("global" as const) : ("project" as const),
  scope_id: projectId ?? "",
  project_id: projectId,
  extension_id: extensionId,
  key: `connection:${contributionId}`,
  sync: projectId === null ? ("device" as const) : ("team" as const),
});
// Keep global configurations separate from shared credentials for project connections.
export const configuredCredentialKey = (key: ConnectionKey, projectId = key.projectId) => ({
  ...key,
  projectId: key.projectId === null ? null : projectId,
  contributionId: key.projectId === null ? `global:${key.contributionId}` : key.contributionId,
});
export const connectionCheckPreference = (key: ConnectionKey) => ({
  ...connectionPreference(key),
  key: `connection-check:${key.contributionId}`,
  sync: "device" as const,
});
const credentialVersion = (secretRef: string) => createHash("sha256").update(secretRef).digest("hex");
export const connectionCheckValue = (check: ExtensionConnectionCheck, secretRef: string) => ({
  credentialVersion: credentialVersion(secretRef),
  check,
});

const wherePreference = (key: ReturnType<typeof connectionPreference>) =>
  and(
    eq(preferences.scope, key.scope),
    eq(preferences.scope_id, key.scope_id),
    eq(preferences.extension_id, key.extension_id),
    eq(preferences.key, key.key),
  );
const whereKey = (key: ConnectionKey) => wherePreference(connectionPreference(key));
const connectionRows = sql`starts_with(${preferences.key}, 'connection:') AND ${preferences.scope} IN ('project', 'global')`;

export const createExtensionConnectionsDBService = (db: DbClient) => {
  const credentialStore = createExtensionCredentialsDBService(db);
  const fromRow = async (row: typeof preferences.$inferSelect) => {
    const config = row.value as ConnectionConfiguration;
    const key = {
      projectId: row.project_id,
      extensionId: row.extension_id,
      contributionId: row.key.slice("connection:".length),
    };
    const [credential, [check]] = await Promise.all([
      credentialStore.resolve(configuredCredentialKey(key), credentialProvider(config.base_url)),
      db
        .select({ value: preferences.value })
        .from(preferences)
        .where(wherePreference(connectionCheckPreference(key))),
    ]);
    const recorded = check?.value as ReturnType<typeof connectionCheckValue> | undefined;
    return {
      ...config,
      project_id: key.projectId,
      extension_id: key.extensionId,
      contribution_id: key.contributionId,
      secret_ref: credential?.secret_ref ?? null,
      last_check_json:
        credential && recorded?.credentialVersion === credentialVersion(credential.secret_ref) ? recorded.check : null,
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
          ...connectionPreference(input),
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
        const provider = credentialProvider(input.baseUrl);
        const key = configuredCredentialKey(input, input.credentialProjectId);
        const shared = input.projectId !== null && key.projectId === null;
        await store.upsert({
          ...input,
          ...(shared ? sharedCredentialKey(key, provider) : key),
          secretRef: input.secretRef,
          provider,
        });
        if (shared) await store.remove(input);
      }
      await tx.delete(preferences).where(wherePreference(connectionCheckPreference(input)));
    });
    return (await get(input))!;
  };
  return {
    credentials: credentialStore,
    get,
    upsert,
    listByProject: (projectId: string) => list(eq(preferences.project_id, projectId)),
    listGlobal: () => list(eq(preferences.scope, "global")),
    listAll: () => list(),
    listByExtension: (projectId: string, extensionId: string) =>
      list(and(eq(preferences.project_id, projectId), eq(preferences.extension_id, extensionId))),
    async removeSharedCredential(input: ConnectionKey, origin: string) {
      const removed = await credentialStore.remove(sharedCredentialKey(input, origin));
      return removed?.secret_ref;
    },
    async removeCredentialAtOrigin(input: ConnectionKey, origin: string) {
      return db.transaction(async (tx) => {
        const store = createExtensionCredentialsDBService(tx);
        const sharedKey = sharedCredentialKey(input, origin);
        const globalKey = configuredCredentialKey({ ...input, projectId: null });
        const [shared, global] = await Promise.all([store.get(sharedKey), store.get(globalKey)]);
        const sharedMatches = shared?.provider === origin;
        const globalMatches = global?.provider === origin;
        if (sharedMatches && globalMatches) return { status: "ambiguous" } as const;
        if (!sharedMatches && !globalMatches) return { status: global ? "wrong-origin" : "absent" } as const;
        const removed = await store.remove(sharedMatches ? sharedKey : globalKey);
        return removed
          ? ({ status: "removed", secretRef: removed.secret_ref } as const)
          : ({ status: "absent" } as const);
      });
    },
    async remove(input: ConnectionKey) {
      return db.transaction(async (tx) => {
        const [removed] = await tx.delete(preferences).where(whereKey(input)).returning({ key: preferences.key });
        if (!removed) return null;
        await tx.delete(preferences).where(wherePreference(connectionCheckPreference(input)));
        const store = createExtensionCredentialsDBService(tx);
        const local = await store.remove(configuredCredentialKey(input));
        return local ? [local.secret_ref] : [];
      });
    },
    async recordCheck(
      input: ConnectionKey,
      check: ExtensionConnectionCheck,
      expected: { id: string; base_url: string; secret_ref: string | null },
    ) {
      if (!expected.secret_ref) return;
      await db.transaction(async (tx) => {
        const [connection] = await tx.select({ value: preferences.value }).from(preferences).where(whereKey(input));
        if (!connection) return;
        const config = connection.value as ConnectionConfiguration;
        if (config.id !== expected.id || config.base_url !== expected.base_url) return;
        const store = createExtensionCredentialsDBService(tx);
        const credential = await store.resolve(configuredCredentialKey(input), credentialProvider(config.base_url));
        if (credential?.secret_ref !== expected.secret_ref) return;
        const value = connectionCheckValue(check, credential.secret_ref);
        await tx
          .insert(preferences)
          .values({ ...connectionCheckPreference(input), value, updated_at: check.checkedAt })
          .onConflictDoUpdate({
            target: [preferences.scope, preferences.scope_id, preferences.extension_id, preferences.key],
            set: { value, updated_at: check.checkedAt },
          });
      });
    },
  };
};
