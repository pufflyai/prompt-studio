import fs from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { normalizeEmbeddedFileName } from "pstdio-paths";
import { removeArchivedWorkspaces } from "./archived-workspaces-migration";
import { finishBoardViewRules, prepareBoardViewRules } from "./board-view-rules-migration";
import {
  ensureLegacyTemplateOwners,
  hasLegacyTemplatesTable,
  migrateLegacyTemplates,
} from "./legacy-template-migration";
import { migrateThrough } from "./migrate-through";
import { resolveMigrationsFolder } from "./migrations-folder";
import { openPglite } from "./open-pglite";
import { ensureDbDirectory, resolveDbPath } from "./paths";
import { acquirePgliteLock } from "./pglite-lock";
import * as schema from "./schemas.pg";
import { removeSharedWorkspaceFolders } from "./shared-workspace-folders";
import { prepareWorkspaceLocations } from "./workspace-location-migration";

type EmbeddedFile = Blob & { name: string };
const PGLITE_WASM_SUFFIX = "/pstdio-db/vendor/pglite/pglite.wasm";
const PGLITE_DATA_SUFFIX = "/pstdio-db/vendor/pglite/pglite.data";
const PGLITE_INITIAL_DATABASE_SUFFIX = "/pstdio-db/vendor/pglite/initial-database.tar.gz";
const LEGACY_TEMPLATE_STORAGE_MIGRATION = 17;

const getEmbeddedFiles = (): EmbeddedFile[] => {
  try {
    const files = (Bun as Record<string, unknown>).embeddedFiles;
    if (Array.isArray(files)) return files as EmbeddedFile[];
  } catch {
    // not available
  }
  return [];
};

export const resolvePgliteOptions = async (embeddedFiles: readonly EmbeddedFile[] = getEmbeddedFiles()) => {
  const wasmFile = embeddedFiles.find((file) => normalizeEmbeddedFileName(file.name).endsWith(PGLITE_WASM_SUFFIX));
  const dataFile = embeddedFiles.find((file) => normalizeEmbeddedFileName(file.name).endsWith(PGLITE_DATA_SUFFIX));
  const initialDatabase = embeddedFiles.find((file) =>
    normalizeEmbeddedFileName(file.name).endsWith(PGLITE_INITIAL_DATABASE_SUFFIX),
  );

  if (!wasmFile && !dataFile && !initialDatabase) return {};
  if (!wasmFile || !dataFile || !initialDatabase) {
    throw new Error(
      "Partial PGlite embed: expected the WebAssembly module, filesystem bundle, and initial database image.",
    );
  }

  const wasmBytes = await wasmFile.arrayBuffer();
  const wasmModule = await WebAssembly.compile(wasmBytes);

  return { fsBundle: dataFile, wasmModule, loadDataDir: initialDatabase };
};

export const createDb = async (options?: { path?: string; onLockAcquired?: () => void }) => {
  const requestedPath = resolveDbPath(options?.path);
  ensureDbDirectory(requestedPath);
  const dbPath = requestedPath === ":memory:" ? requestedPath : fs.realpathSync(requestedPath);

  const releaseLock = dbPath === ":memory:" ? () => {} : acquirePgliteLock(dbPath);

  let pglite: PGlite | undefined;
  try {
    options?.onLockAcquired?.();
    const pgliteOpts = await resolvePgliteOptions();
    pglite = openPglite(dbPath, pgliteOpts);
    const openedPglite = pglite;
    await openedPglite.waitReady;
    console.log("[createDb] PGlite ready");

    const db = drizzle(openedPglite, { schema });
    const migrations = await resolveMigrationsFolder({ embeddedFiles: getEmbeddedFiles() });
    const migrationsFolder = migrations.path;
    try {
      if (fs.existsSync(migrationsFolder)) {
        if (await hasLegacyTemplatesTable(openedPglite)) {
          const storage = await openedPglite.query<{ extension_files: string | null }>(
            "SELECT to_regclass('public.extension_files')::text AS extension_files",
          );
          if (!storage.rows[0]?.extension_files) {
            await migrateThrough(db, migrationsFolder, LEGACY_TEMPLATE_STORAGE_MIGRATION);
          }
          await ensureLegacyTemplateOwners(openedPglite);
        }
        await migrateLegacyTemplates(openedPglite);
        const legacy = await openedPglite.query<{ legacy: boolean }>(
          "SELECT to_regclass('public.projects') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'root_path') AS legacy",
        );
        if (legacy.rows[0]?.legacy) await migrateThrough(db, migrationsFolder, 31);
        await prepareWorkspaceLocations(openedPglite);
        await removeSharedWorkspaceFolders(openedPglite, db, migrationsFolder);
        await prepareBoardViewRules(openedPglite);
        await removeArchivedWorkspaces(openedPglite);
        await migrate(db, { migrationsFolder });
        await finishBoardViewRules(openedPglite);
      }
    } finally {
      migrations.cleanup();
    }

    let closed = false;
    const close = async () => {
      if (closed) {
        return;
      }

      closed = true;
      try {
        await openedPglite.close();
      } finally {
        releaseLock();
      }
    };

    return {
      close,
      db,
      path: dbPath,
      pglite: openedPglite,
    };
  } catch (error) {
    await pglite?.close();
    releaseLock();
    throw error;
  }
};

export type DbClient = PgliteDatabase<typeof schema>;
