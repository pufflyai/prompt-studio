import { sep } from "node:path";
import { and, eq, gte, lt } from "drizzle-orm";
import {
  canonicalExtensionId,
  canonicalInstallName,
  historicalExtensionId,
  matchesExtensionInstallName,
} from "pstdio-api-contracts/extension-host";
import type { DbClient } from "../../db/connection.pglite";
import { installed_extension_sources } from "../../db/schemas.pg";
import { migrateExtensionIdentities } from "../extension-identity-migration";

type InstalledSourceRow = typeof installed_extension_sources.$inferSelect;
type InstalledSourceInsert = typeof installed_extension_sources.$inferInsert;

let lastTimestampMs = 0;
const nowTimestamp = () => {
  const nextTimestampMs = Math.max(Date.now(), lastTimestampMs + 1);
  lastTimestampMs = nextTimestampMs;
  return new Date(nextTimestampMs).toISOString();
};

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

export const createInstalledExtensionSourcesDBService = (
  db: DbClient,
  onRenamed?: (change: { from: string; to: string }) => Promise<void>,
) => {
  const migrateIdentity = (extensionId: string) => migrateExtensionIdentities(db, { extensionId, onRenamed });
  const list = async () =>
    db.select().from(installed_extension_sources).orderBy(installed_extension_sources.install_name);

  const get = async (id: string) => {
    const [row] = await db.select().from(installed_extension_sources).where(eq(installed_extension_sources.id, id));
    return row ?? null;
  };

  const getByInstallName = async (installName: string) => {
    const rows = (await list()).filter((row) =>
      matchesExtensionInstallName({ extensionId: row.extension_id, installName: row.install_name }, installName),
    );
    if (new Set(rows.map((row) => row.extension_id)).size > 1)
      throw new Error(`Extension install name is ambiguous: ${installName}. Use its publisher-qualified ID.`);
    return rows.find((row) => row.install_name === canonicalInstallName(installName)) ?? rows[0] ?? null;
  };

  const getBySourcePath = async (sourcePath: string) => {
    const [row] = await db
      .select()
      .from(installed_extension_sources)
      .where(eq(installed_extension_sources.source_path, sourcePath));
    return row ?? null;
  };

  const listBySourcePathPrefix = async (sourcePathPrefix: string) => {
    const childPathPrefix = `${sourcePathPrefix}${sep}`;
    const nextPathPrefix = `${sourcePathPrefix}${String.fromCharCode(sep.charCodeAt(0) + 1)}`;

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
    await migrateIdentity(input.extension_id);
    const extension_id = canonicalExtensionId(input.extension_id);
    if (historicalExtensionId(extension_id) !== extension_id)
      input = {
        ...input,
        extension_id,
        install_name: matchesExtensionInstallName(
          { extensionId: extension_id, installName: canonicalInstallName(extension_id) },
          input.install_name,
        )
          ? canonicalInstallName(extension_id)
          : input.install_name,
        manifest_json:
          input.manifest_json &&
          typeof input.manifest_json.name === "string" &&
          matchesExtensionInstallName(
            { extensionId: extension_id, installName: canonicalInstallName(extension_id) },
            input.manifest_json.name,
          )
            ? { ...input.manifest_json, name: canonicalInstallName(input.extension_id) }
            : input.manifest_json,
      };
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
    const current = await get(id);
    if (current?.last_error_json?.code === "extension_identity_conflict") await migrateIdentity(current.extension_id);
    const timestamp = nowTimestamp();
    const [updated] = await db
      .update(installed_extension_sources)
      .set({ ...input, updated_at: timestamp })
      .where(eq(installed_extension_sources.id, id))
      .returning();
    return updated ?? null;
  };

  const updateRegistration = async (id: string, input: UpdateRegistrationInput) => {
    const current = await get(id);
    if (input.extension_id || current?.last_error_json?.code === "extension_identity_conflict")
      await migrateIdentity(input.extension_id ?? current!.extension_id);
    const owner = input.extension_id ?? current?.extension_id;
    if (owner) {
      const extension_id = canonicalExtensionId(owner);
      input = { ...input, extension_id };
      if (
        input.manifest_json &&
        typeof input.manifest_json.name === "string" &&
        historicalExtensionId(extension_id) !== extension_id &&
        matchesExtensionInstallName(
          { extensionId: extension_id, installName: canonicalInstallName(extension_id) },
          input.manifest_json.name,
        )
      )
        input.manifest_json = { ...input.manifest_json, name: canonicalInstallName(owner) };
    }
    const timestamp = nowTimestamp();
    const [updated] = await db
      .update(installed_extension_sources)
      .set({ ...input, updated_at: timestamp })
      .where(eq(installed_extension_sources.id, id))
      .returning();
    return updated ?? null;
  };

  const updateLoadStateIfUnchanged = async (id: string, updatedAt: string, input: UpdateLoadStateInput) => {
    const current = await get(id);
    if (current?.last_error_json?.code === "extension_identity_conflict") await migrateIdentity(current.extension_id);
    const [updated] = await db
      .update(installed_extension_sources)
      .set({ ...input, updated_at: nowTimestamp() })
      .where(and(eq(installed_extension_sources.id, id), eq(installed_extension_sources.updated_at, updatedAt)))
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

  return {
    list,
    get,
    getByInstallName,
    getBySourcePath,
    listBySourcePathPrefix,
    register,
    updateLoadState,
    updateLoadStateIfUnchanged,
    updateRegistration,
    markStatus,
    remove,
  };
};
