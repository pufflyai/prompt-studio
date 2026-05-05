import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { extension_instances } from "../../db/schemas.pg";

type InstanceRow = typeof extension_instances.$inferSelect;
type InstanceInsert = typeof extension_instances.$inferInsert;

const nowTimestamp = () => new Date().toISOString();

export type CreateInstanceInput = {
  installed_extension_id: string;
  scope_type: string;
  scope_id: string;
  namespace: string;
  display_name_override?: string | null;
  enabled?: boolean;
  config_json?: InstanceRow["config_json"];
};

export type UpdateInstanceInput = {
  enabled?: boolean;
  display_name_override?: string | null;
  namespace?: string;
  config_json?: InstanceRow["config_json"];
  diagnostics_json?: InstanceRow["diagnostics_json"];
};

export const createExtensionInstancesDBService = (db: DbClient) => {
  const list = async (filters?: { scope_type?: string; scope_id?: string; installed_extension_id?: string }) => {
    const conditions = [];
    if (filters?.scope_type) conditions.push(eq(extension_instances.scope_type, filters.scope_type));
    if (filters?.scope_id) conditions.push(eq(extension_instances.scope_id, filters.scope_id));
    if (filters?.installed_extension_id)
      conditions.push(eq(extension_instances.installed_extension_id, filters.installed_extension_id));

    const query = db.select().from(extension_instances);
    return conditions.length > 0
      ? query.where(and(...conditions)).orderBy(extension_instances.namespace)
      : query.orderBy(extension_instances.namespace);
  };

  const get = async (id: string) => {
    const [row] = await db.select().from(extension_instances).where(eq(extension_instances.id, id));
    return row ?? null;
  };

  const findByScopeNamespace = async (scopeType: string, scopeId: string, namespace: string) => {
    const [row] = await db
      .select()
      .from(extension_instances)
      .where(
        and(
          eq(extension_instances.scope_type, scopeType),
          eq(extension_instances.scope_id, scopeId),
          eq(extension_instances.namespace, namespace),
        ),
      );
    return row ?? null;
  };

  const create = async (input: CreateInstanceInput) => {
    const timestamp = nowTimestamp();
    const row: InstanceInsert = {
      id: crypto.randomUUID(),
      installed_extension_id: input.installed_extension_id,
      scope_type: input.scope_type,
      scope_id: input.scope_id,
      namespace: input.namespace,
      display_name_override: input.display_name_override ?? null,
      enabled: input.enabled ?? true,
      config_json: input.config_json ?? {},
      diagnostics_json: null,
      created_at: timestamp,
      updated_at: timestamp,
    };
    await db.insert(extension_instances).values(row);
    return row as InstanceRow;
  };

  const update = async (id: string, input: UpdateInstanceInput) => {
    const [updated] = await db
      .update(extension_instances)
      .set({ ...input, updated_at: nowTimestamp() })
      .where(eq(extension_instances.id, id))
      .returning();
    return updated ?? null;
  };

  const remove = async (id: string) => {
    const deleted = await db
      .delete(extension_instances)
      .where(eq(extension_instances.id, id))
      .returning({ id: extension_instances.id });
    return deleted.length > 0;
  };

  return { list, get, findByScopeNamespace, create, update, remove };
};
