import { eq } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { extension_reload_events, installed_extension_sources } from "../../db/schemas.pg";

type InstalledSourceRow = typeof installed_extension_sources.$inferSelect;
type InstalledSourceInsert = typeof installed_extension_sources.$inferInsert;
type ReloadEventRow = typeof extension_reload_events.$inferSelect;

const nowTimestamp = () => new Date().toISOString();

export type RegisterInput = Omit<InstalledSourceInsert, "id" | "created_at" | "updated_at" | "status"> & {
  status?: InstalledSourceRow["status"];
};

export type UpdateLoadStateInput = {
  source_hash?: string | null;
  loaded_revision?: string | null;
  status?: InstalledSourceRow["status"];
  manifest_json?: InstalledSourceRow["manifest_json"];
  last_loaded_at?: string | null;
  last_error_json?: InstalledSourceRow["last_error_json"];
};

export type UpdateRegistrationInput = Partial<
  Pick<
    InstalledSourceInsert,
    "display_name" | "extension_id" | "manifest_json" | "source_kind" | "source_path" | "source_ref" | "version"
  >
> &
  UpdateLoadStateInput;

export type RecordReloadInput = {
  installed_extension_id: string;
  previous_source_hash?: string | null;
  next_source_hash?: string | null;
  previous_revision?: string | null;
  next_revision?: string | null;
  status: ReloadEventRow["status"];
  error_json?: ReloadEventRow["error_json"];
};

export const createInstalledExtensionSourcesDBService = (db: DbClient) => {
  const list = async () =>
    db.select().from(installed_extension_sources).orderBy(installed_extension_sources.install_name);

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

  const register = async (input: RegisterInput) => {
    const timestamp = nowTimestamp();
    const row: InstalledSourceInsert = {
      id: crypto.randomUUID(),
      status: "pending",
      ...input,
      created_at: timestamp,
      updated_at: timestamp,
    };
    await db.insert(installed_extension_sources).values(row);
    return row as InstalledSourceRow;
  };

  const updateLoadState = async (id: string, input: UpdateLoadStateInput) => {
    const timestamp = nowTimestamp();
    const [updated] = await db
      .update(installed_extension_sources)
      .set({ ...input, updated_at: timestamp })
      .where(eq(installed_extension_sources.id, id))
      .returning();
    return updated ?? null;
  };

  const updateRegistration = async (id: string, input: UpdateRegistrationInput) => {
    const timestamp = nowTimestamp();
    const [updated] = await db
      .update(installed_extension_sources)
      .set({ ...input, updated_at: timestamp })
      .where(eq(installed_extension_sources.id, id))
      .returning();
    return updated ?? null;
  };

  const remove = async (id: string) => {
    const deleted = await db
      .delete(installed_extension_sources)
      .where(eq(installed_extension_sources.id, id))
      .returning({ id: installed_extension_sources.id });
    return deleted.length > 0;
  };

  const recordReload = async (input: RecordReloadInput) => {
    const row: typeof extension_reload_events.$inferInsert = {
      id: crypto.randomUUID(),
      installed_extension_id: input.installed_extension_id,
      previous_source_hash: input.previous_source_hash ?? null,
      next_source_hash: input.next_source_hash ?? null,
      previous_revision: input.previous_revision ?? null,
      next_revision: input.next_revision ?? null,
      status: input.status,
      error_json: input.error_json ?? null,
      created_at: nowTimestamp(),
    };
    await db.insert(extension_reload_events).values(row);
    return row as ReloadEventRow;
  };

  const listReloadEvents = async (installedExtensionId: string, limit = 50) =>
    db
      .select()
      .from(extension_reload_events)
      .where(eq(extension_reload_events.installed_extension_id, installedExtensionId))
      .orderBy(extension_reload_events.created_at)
      .limit(limit);

  return {
    list,
    get,
    getByInstallName,
    register,
    updateLoadState,
    updateRegistration,
    remove,
    recordReload,
    listReloadEvents,
  };
};
