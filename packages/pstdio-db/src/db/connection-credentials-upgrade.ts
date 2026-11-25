import { createReadStream } from "node:fs";
import { open, rename, rm } from "node:fs/promises";
import { dirname } from "node:path";
import { createInterface } from "node:readline";
import { sql } from "drizzle-orm";
import { credentialProvider } from "../services/extension-connections/credentials";
import {
  type ConnectionConfiguration,
  configuredCredentialKey,
  connectionPreference,
} from "../services/extension-connections/extension-connections";
import type { DbClient } from "./connection.pglite";
import { flushDirectory } from "./pglite-home-recovery";
import { credentials, type ExtensionConnectionCheck } from "./schemas/credentials";
import { preferences } from "./schemas/preferences";
import { readUpgradeRows } from "./upgrade-rows";

type ReleasedConnection = Record<string, unknown> &
  ConnectionConfiguration & {
    project_id: string | null;
    extension_id: string;
    contribution_id: string;
    secret_ref: string | null;
    last_check_json: ExtensionConnectionCheck | null;
    updated_at: string;
  };
async function* readSnapshot(path: string) {
  const stream = createReadStream(path, { encoding: "utf8" });
  const lines = createInterface({ input: stream, crlfDelay: Number.POSITIVE_INFINITY });
  try {
    for await (const line of lines) if (line) yield JSON.parse(line) as ReleasedConnection;
  } finally {
    lines.close();
    stream.destroy();
  }
}
async function* readReleasedConnections(db: DbClient, tables: Set<string>) {
  if (tables.has("extension_connections"))
    for await (const row of readUpgradeRows(db, { table: "extension_connections", keys: ["id"] }))
      yield row as ReleasedConnection;
  if (tables.has("extension_settings"))
    for await (const row of readUpgradeRows(db, {
      table: "extension_settings",
      keys: ["owner_type", "owner_id", "extension_id", "key"],
      where: sql`owner_type = 'device_connection'`,
    })) {
      const saved = row.value_json as ReleasedConnection;
      yield { ...saved, project_id: null, extension_id: String(row.extension_id), contribution_id: String(row.key) };
    }
}
const capture = async (db: DbClient, snapshot: string | undefined) => {
  const { rows } = await db.execute<{ table_name: string }>(sql`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    AND table_name IN ('extension_connections', 'extension_settings')`);
  if (!rows.length) return;
  const memory: ReleasedConnection[] = [];
  const temporary = snapshot && `${snapshot}.tmp`;
  const file = temporary ? await open(temporary, "w", 0o600) : undefined;
  try {
    for await (const row of readReleasedConnections(db, new Set(rows.map(({ table_name }) => table_name)))) {
      if (file) await file.writeFile(`${JSON.stringify(row)}\n`);
      else memory.push(row);
    }
    await file?.sync();
  } catch (error) {
    await file?.close();
    if (temporary) await rm(temporary, { force: true });
    throw error;
  } finally {
    await file?.close();
  }
  if (snapshot && temporary) {
    await rename(temporary, snapshot);
    await flushDirectory(dirname(snapshot));
  }
  return memory;
};
const hasSnapshot = async (path: string) => {
  try {
    const file = await open(path, "r");
    await file.close();
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return false;
  }
};
// The private conversion file contains secret references, never the secret bytes. Keep it
// until both ownership domains commit; a restart can resume after the old table is dropped.
export const prepareConnectionCredentialsUpgrade = async (db: DbClient, path: string) => {
  const snapshot = path === ":memory:" ? undefined : `${path}-connection-credentials-upgrade.jsonl`;
  let memory: ReleasedConnection[] = [];
  if (!snapshot || !(await hasSnapshot(snapshot))) {
    const captured = await capture(db, snapshot);
    if (!captured) return;
    memory = captured;
  }
  return async () => {
    for await (const row of snapshot ? readSnapshot(snapshot) : memory)
      await db.transaction(async (tx) => {
        const {
          id,
          project_id,
          extension_id,
          contribution_id,
          base_url,
          auth_type,
          auth_header_name,
          config_json,
          created_at,
          updated_at,
          secret_ref,
          last_check_json,
        } = row;
        const key = { projectId: project_id, extensionId: extension_id, contributionId: contribution_id };
        await tx
          .insert(preferences)
          .values({
            ...connectionPreference(key),
            value: { id, base_url, auth_type, auth_header_name, config_json, created_at },
            updated_at,
          })
          .onConflictDoNothing();
        // Existing sign-ins retain their original project boundary. Only new explicit sign-ins
        // can choose all projects; migration never broadens a credential's authority.
        if (secret_ref)
          await tx
            .insert(credentials)
            .values({
              id,
              project_id,
              extension_id,
              contribution_id: configuredCredentialKey(key).contributionId,
              provider: credentialProvider(base_url),
              auth_type,
              auth_header_name,
              secret_ref,
              last_check: last_check_json,
              created_at,
              updated_at,
            })
            .onConflictDoNothing();
      });
    if (snapshot) {
      await rm(snapshot);
      await flushDirectory(dirname(snapshot));
    }
  };
};
