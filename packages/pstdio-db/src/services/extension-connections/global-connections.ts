import { and, eq, sql } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import type { ExtensionConnectionCheck } from "../../db/schemas/extension-connections";
import { type extension_connections, extension_settings } from "../../db/schemas.pg";

type Connection = Omit<typeof extension_connections.$inferSelect, "project_id"> & { project_id: null };
const ownerType = "device_connection";
const owner = (extensionId: string) => ({ owner_type: ownerType, owner_id: extensionId, extension_id: extensionId });

// Connection metadata shares the host-only configuration table. Credentials stay
// in the secret store, and these rows have no project lifetime or sync owner.
export const createGlobalConnectionsStore = (db: DbClient) => {
  const key = (extensionId: string, connectionId: string) =>
    and(
      eq(extension_settings.owner_type, ownerType),
      eq(extension_settings.owner_id, extensionId),
      eq(extension_settings.extension_id, extensionId),
      eq(extension_settings.key, connectionId),
    );
  const get = async (extensionId: string, connectionId: string) => {
    const [row] = await db.select().from(extension_settings).where(key(extensionId, connectionId));
    return row ? (row.value_json as Connection) : null;
  };
  const list = async () =>
    (await db.select().from(extension_settings).where(eq(extension_settings.owner_type, ownerType))).map(
      (row) => row.value_json as Connection,
    );
  const set = async (row: Connection) => {
    await db
      .insert(extension_settings)
      .values({
        ...owner(row.extension_id),
        key: row.contribution_id,
        value_json: row,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })
      .onConflictDoUpdate({
        target: [
          extension_settings.owner_type,
          extension_settings.owner_id,
          extension_settings.extension_id,
          extension_settings.key,
        ],
        set: { value_json: row, updated_at: row.updated_at },
      });
    return row;
  };
  const recordCheck = async (extensionId: string, connectionId: string, check: ExtensionConnectionCheck) => {
    await db
      .update(extension_settings)
      .set({
        value_json: sql`jsonb_set(${extension_settings.value_json}, '{last_check_json}', ${JSON.stringify(check)}::jsonb)`,
      })
      .where(key(extensionId, connectionId));
  };
  const remove = async (extensionId: string, connectionId: string) => {
    const row = await get(extensionId, connectionId);
    await db.delete(extension_settings).where(key(extensionId, connectionId));
    return row;
  };
  return { get, list, set, remove, recordCheck };
};
