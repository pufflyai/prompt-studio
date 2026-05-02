import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { extension_kv } from "../../db/schemas.pg";

type ScopeKey = {
  project_id: string;
  extension_id: string;
  namespace: string;
  scope_type: string;
  scope_id: string;
  key: string;
};

type SetInput = Omit<ScopeKey, "key"> & {
  key: string;
  value: unknown;
};

const nowTimestamp = () => new Date().toISOString();

const matchKey = (input: ScopeKey) =>
  and(
    eq(extension_kv.project_id, input.project_id),
    eq(extension_kv.extension_id, input.extension_id),
    eq(extension_kv.scope_type, input.scope_type),
    eq(extension_kv.scope_id, input.scope_id),
    eq(extension_kv.key, input.key),
  );

export const createExtensionKvDBService = (db: DbClient) => {
  const get = async (input: ScopeKey) => {
    const [row] = await db.select().from(extension_kv).where(matchKey(input));
    return row ? (row.value_json as unknown) : null;
  };

  const set = async (input: SetInput) => {
    const timestamp = nowTimestamp();

    await db
      .insert(extension_kv)
      .values({
        project_id: input.project_id,
        extension_id: input.extension_id,
        namespace: input.namespace,
        scope_type: input.scope_type,
        scope_id: input.scope_id,
        key: input.key,
        value_json: input.value,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .onConflictDoUpdate({
        target: [
          extension_kv.project_id,
          extension_kv.extension_id,
          extension_kv.scope_type,
          extension_kv.scope_id,
          extension_kv.key,
        ],
        set: {
          value_json: input.value,
          namespace: input.namespace,
          updated_at: timestamp,
        },
      });
  };

  const delete_ = async (input: ScopeKey) => {
    const result = await db.delete(extension_kv).where(matchKey(input)).returning({ key: extension_kv.key });
    return result.length > 0;
  };

  const listByExtension = async (projectId: string, extensionId: string) =>
    db
      .select()
      .from(extension_kv)
      .where(and(eq(extension_kv.project_id, projectId), eq(extension_kv.extension_id, extensionId)))
      .orderBy(extension_kv.scope_type, extension_kv.scope_id, extension_kv.key);

  const listByScope = async (input: Pick<ScopeKey, "project_id" | "extension_id" | "scope_type" | "scope_id">) =>
    db
      .select()
      .from(extension_kv)
      .where(
        and(
          eq(extension_kv.project_id, input.project_id),
          eq(extension_kv.extension_id, input.extension_id),
          eq(extension_kv.scope_type, input.scope_type),
          eq(extension_kv.scope_id, input.scope_id),
        ),
      )
      .orderBy(extension_kv.key);

  return { get, set, delete: delete_, listByExtension, listByScope };
};
