import { eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { installed_extension_sources } from "../../db/schemas.pg";

type InstalledExtensionSourceRecord = typeof installed_extension_sources.$inferSelect;

type CreateInput = {
  install_name: string;
  extension_id: string;
  namespace: string;
  display_name: string;
  version?: string | null;
  source_path: string;
  source_kind: string;
  source_ref?: string | null;
  manifest_json?: Record<string, unknown>;
};

type UpdateInput = Partial<{
  display_name: string;
  version: string | null;
  source_kind: string;
  source_ref: string | null;
  manifest_json: Record<string, unknown>;
  last_loaded_at: string | null;
  last_error_json: Record<string, unknown> | null;
}>;

const nowTimestamp = () => new Date().toISOString();

export const createInstalledExtensionSourcesDBService = (db: DbClient) => {
  const create = async (input: CreateInput) => {
    const timestamp = nowTimestamp();

    const record: InstalledExtensionSourceRecord = {
      id: crypto.randomUUID(),
      install_name: input.install_name,
      extension_id: input.extension_id,
      namespace: input.namespace,
      display_name: input.display_name,
      version: input.version ?? null,
      source_path: input.source_path,
      source_kind: input.source_kind,
      source_ref: input.source_ref ?? null,
      manifest_json: input.manifest_json ?? {},
      last_loaded_at: null,
      last_error_json: null,
      created_at: timestamp,
      updated_at: timestamp,
    };

    await db.insert(installed_extension_sources).values(record);
    return record;
  };

  const get = async (id: string) => {
    const [row] = await db.select().from(installed_extension_sources).where(eq(installed_extension_sources.id, id));
    return row ?? null;
  };

  const getByInstallName = async (installName: string) => {
    const [row] = await db
      .select()
      .from(installed_extension_sources)
      .where(eq(installed_extension_sources.install_name, installName));
    return row ?? null;
  };

  const list = async () =>
    db.select().from(installed_extension_sources).orderBy(installed_extension_sources.install_name);

  const update = async (id: string, input: UpdateInput) => {
    const [updated] = await db
      .update(installed_extension_sources)
      .set({ ...input, updated_at: nowTimestamp() })
      .where(eq(installed_extension_sources.id, id))
      .returning();
    return updated ?? null;
  };

  const remove = async (id: string) => {
    const result = await db
      .delete(installed_extension_sources)
      .where(eq(installed_extension_sources.id, id))
      .returning({ id: installed_extension_sources.id });
    return result.length > 0;
  };

  return { create, get, getByInstallName, list, update, remove };
};
