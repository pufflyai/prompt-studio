import { and, eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { project_extension_instances } from "../../db/schemas.pg";

type ProjectExtensionInstanceRecord = typeof project_extension_instances.$inferSelect;

type CreateInput = {
  project_id: string;
  installed_extension_id: string;
  extension_id: string;
  namespace: string;
  display_name: string;
  enabled?: boolean;
  config_json?: Record<string, unknown>;
};

type UpdateInput = Partial<{
  display_name: string;
  enabled: boolean;
  config_json: Record<string, unknown>;
  diagnostics_json: Record<string, unknown> | null;
}>;

const nowTimestamp = () => new Date().toISOString();

export const createProjectExtensionInstancesDBService = (db: DbClient) => {
  const create = async (input: CreateInput) => {
    const timestamp = nowTimestamp();

    const record: ProjectExtensionInstanceRecord = {
      id: crypto.randomUUID(),
      project_id: input.project_id,
      installed_extension_id: input.installed_extension_id,
      extension_id: input.extension_id,
      namespace: input.namespace,
      display_name: input.display_name,
      enabled: input.enabled ?? true,
      config_json: input.config_json ?? {},
      diagnostics_json: null,
      created_at: timestamp,
      updated_at: timestamp,
    };

    await db.insert(project_extension_instances).values(record);
    return record;
  };

  const get = async (id: string) => {
    const [row] = await db.select().from(project_extension_instances).where(eq(project_extension_instances.id, id));
    return row ?? null;
  };

  const listByProject = async (projectId: string) =>
    db
      .select()
      .from(project_extension_instances)
      .where(eq(project_extension_instances.project_id, projectId))
      .orderBy(project_extension_instances.namespace);

  const getByExtensionId = async (projectId: string, extensionId: string) => {
    const [row] = await db
      .select()
      .from(project_extension_instances)
      .where(
        and(
          eq(project_extension_instances.project_id, projectId),
          eq(project_extension_instances.extension_id, extensionId),
        ),
      );
    return row ?? null;
  };

  const update = async (id: string, input: UpdateInput) => {
    const [updated] = await db
      .update(project_extension_instances)
      .set({ ...input, updated_at: nowTimestamp() })
      .where(eq(project_extension_instances.id, id))
      .returning();
    return updated ?? null;
  };

  const setEnabled = async (id: string, enabled: boolean) => update(id, { enabled });
  const setConfig = async (id: string, config: Record<string, unknown>) => update(id, { config_json: config });

  const remove = async (id: string) => {
    const result = await db
      .delete(project_extension_instances)
      .where(eq(project_extension_instances.id, id))
      .returning({ id: project_extension_instances.id });
    return result.length > 0;
  };

  return { create, get, listByProject, getByExtensionId, update, setEnabled, setConfig, remove };
};
