import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import type { DbClient } from "../../db/connection.pglite";
import { extension_reload_events, installed_extension_sources } from "../../db/schemas.pg";

type InstalledSourceRow = typeof installed_extension_sources.$inferSelect;
type InstalledSourceInsert = typeof installed_extension_sources.$inferInsert;
type ReloadEventRow = typeof extension_reload_events.$inferSelect;

let lastTimestampMs = 0;
const nowTimestamp = () => {
  const nextTimestampMs = Math.max(Date.now(), lastTimestampMs + 1);
  lastTimestampMs = nextTimestampMs;
  return new Date(nextTimestampMs).toISOString();
};
const RELOAD_EVENT_RETENTION = 100;

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

  const getBySourcePath = async (sourcePath: string) => {
    const [row] = await db
      .select()
      .from(installed_extension_sources)
      .where(eq(installed_extension_sources.source_path, sourcePath));
    return row ?? null;
  };

  const listBySourcePathPrefix = async (sourcePathPrefix: string) => {
    const childPathPrefix = `${sourcePathPrefix}/`;
    const nextPathPrefix = `${sourcePathPrefix}0`;

    return db
      .select()
      .from(installed_extension_sources)
      .where(
        and(
          gte(installed_extension_sources.source_path, childPathPrefix),
          lt(installed_extension_sources.source_path, nextPathPrefix),
        ),
      )
      .orderBy(installed_extension_sources.install_name);
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

  const markStatus = async (
    id: string,
    status: InstalledSourceRow["status"],
    lastErrorJson?: InstalledSourceRow["last_error_json"],
  ) => updateLoadState(id, { status, last_error_json: lastErrorJson ?? null });

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
    await db.transaction(async (tx) => {
      await tx.insert(extension_reload_events).values(row);
      const retained = await tx
        .select({ id: extension_reload_events.id })
        .from(extension_reload_events)
        .where(eq(extension_reload_events.installed_extension_id, input.installed_extension_id))
        .orderBy(desc(extension_reload_events.created_at))
        .limit(RELOAD_EVENT_RETENTION);
      const retainedIds = new Set(retained.map((event) => event.id));
      const stale = await tx
        .select({ id: extension_reload_events.id })
        .from(extension_reload_events)
        .where(eq(extension_reload_events.installed_extension_id, input.installed_extension_id));
      const staleIds = stale.map((event) => event.id).filter((id) => !retainedIds.has(id));
      if (staleIds.length > 0) {
        await tx.delete(extension_reload_events).where(inArray(extension_reload_events.id, staleIds));
      }
    });
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
    getBySourcePath,
    listBySourcePathPrefix,
    register,
    updateLoadState,
    updateRegistration,
    markStatus,
    remove,
    recordReload,
    listReloadEvents,
  };
};
