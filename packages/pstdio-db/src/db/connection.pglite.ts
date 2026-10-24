import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { normalizeEmbeddedFileName } from "pstdio-paths";
import { removeArchivedWorkspaces } from "./archived-workspaces-migration";
import { finishBoardViewRules, prepareBoardViewRules } from "./board-view-rules-migration";
import { migrateThrough } from "./migrate-through";
import { openPglite } from "./open-pglite";
import { canonicalDbPath, resolveDbPath } from "./paths";
import { acquirePgliteLock } from "./pglite-lock";
import { type PgliteUpgradePhase, prepareCurrentPgliteHome } from "./pglite-upgrade";
import { snapshotLegacyQueuedRequests } from "./queued-request-migration";
import * as schema from "./schemas.pg";
import { removeSharedWorkspaceFolders } from "./shared-workspace-folders";
import { migrateWorkspaceCapabilities } from "./workspace-capabilities-migration";
import { prepareWorkspaceLocations } from "./workspace-location-migration";

type EmbeddedFile = Blob & { name: string };
// Bun's embedded file objects are runtime-specific; narrowing the contract keeps extraction testable
// without depending on full Blob behavior that unit tests do not control.
type EmbeddedMigrationFile = Pick<EmbeddedFile, "name" | "size" | "arrayBuffer">;

const DRIZZLE_PREFIX = "../../pstdio-db/drizzle/";
const DRIZZLE_EXTRACT_DIR = "pstdio-drizzle";
const PGLITE_WASM_SUFFIX = "/pstdio-db/vendor/pglite/pglite.wasm";
const PGLITE_DATA_SUFFIX = "/pstdio-db/vendor/pglite/pglite.data";
const PGLITE_INITIAL_DATABASE_SUFFIX = "/pstdio-db/vendor/pglite/initial-database.tar.gz";
const PGLITE_ICU_SUFFIX = "/pstdio-db/vendor/pglite/icu.76.tgz";

const getEmbeddedFiles = (): EmbeddedFile[] => {
  try {
    const files = (Bun as Record<string, unknown>).embeddedFiles;
    if (Array.isArray(files)) return files as EmbeddedFile[];
  } catch {
    // not available
  }
  return [];
};

const extractEmbeddedMigrations = async (
  embeddedFiles: readonly EmbeddedMigrationFile[],
  root: string,
  logger: (message: string) => void,
) => {
  for (const file of embeddedFiles) {
    const relativePath = normalizeEmbeddedFileName(file.name).slice(DRIZZLE_PREFIX.length);
    const outPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    logger(`[drizzle] extracting ${relativePath} (${file.size} bytes)`);
    const buf = await file.arrayBuffer();
    fs.writeFileSync(outPath, Buffer.from(buf));
  }
};

export const resolveMigrationsFolder = async (
  options: {
    embeddedFiles?: readonly EmbeddedMigrationFile[];
    tmpDir?: string;
    logger?: (message: string) => void;
  } = {},
) => {
  const embeddedSource = options.embeddedFiles ?? getEmbeddedFiles();
  // Schema snapshots belong to migration generation; extracting them delays packaged startup.
  const embedded = embeddedSource.filter((file) => {
    const name = normalizeEmbeddedFileName(file.name);
    return name.startsWith(DRIZZLE_PREFIX) && (name.endsWith(".sql") || name === `${DRIZZLE_PREFIX}meta/_journal.json`);
  });

  if (embedded.length > 0) {
    const root = fs.mkdtempSync(path.join(options.tmpDir ?? os.tmpdir(), `${DRIZZLE_EXTRACT_DIR}-`));
    const dispose = () => fs.rmSync(root, { recursive: true, force: true });
    try {
      await extractEmbeddedMigrations(embedded, root, options.logger ?? console.log);
      return { path: root, dispose };
    } catch (error) {
      dispose();
      throw error;
    }
  }

  return {
    path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle"),
    dispose: () => {},
  };
};

const withMigrationsFolder = async (run: (folder: string) => Promise<void>) => {
  const migrations = await resolveMigrationsFolder();
  try {
    await run(migrations.path);
  } finally {
    migrations.dispose();
  }
};

export const resolvePgliteOptions = async (embeddedFiles: readonly EmbeddedFile[] = getEmbeddedFiles()) => {
  const wasmFile = embeddedFiles.find((file) => normalizeEmbeddedFileName(file.name).endsWith(PGLITE_WASM_SUFFIX));
  const dataFile = embeddedFiles.find((file) => normalizeEmbeddedFileName(file.name).endsWith(PGLITE_DATA_SUFFIX));
  const initialDatabase = embeddedFiles.find((file) =>
    normalizeEmbeddedFileName(file.name).endsWith(PGLITE_INITIAL_DATABASE_SUFFIX),
  );
  const icu = embeddedFiles.find((file) => normalizeEmbeddedFileName(file.name).endsWith(PGLITE_ICU_SUFFIX));
  const identity = { database: "template1", username: "postgres" };
  if (!wasmFile && !dataFile && !initialDatabase && !icu) {
    const require = createRequire(import.meta.url);
    const icuPath = path.join(path.dirname(require.resolve("@electric-sql/pglite-icu-full")), "icu.76.tgz");
    return {
      ...identity,
      icuDataDir: Bun.file(icuPath),
      loadDataDir: Bun.file(path.join(import.meta.dirname, "../../vendor/pglite/empty-database.tar.gz")),
    };
  }
  if (!wasmFile || !dataFile || !initialDatabase || !icu) {
    throw new Error(
      "Partial PGlite embed: expected the WebAssembly module, filesystem bundle, full ICU data and initial database image.",
    );
  }

  const wasmBytes = await wasmFile.arrayBuffer();
  const wasmModule = await WebAssembly.compile(wasmBytes);

  return {
    ...identity,
    fsBundle: dataFile,
    pgliteWasmModule: wasmModule,
    loadDataDir: initialDatabase,
    icuDataDir: icu,
  };
};

// Startup steps in order. The runtime publishes itself once the database is locked and logs every step.
export type DbOpenPhase =
  | PgliteUpgradePhase
  | "database_locked"
  | "database_engine_loaded"
  | "database_image_restored"
  | "database_opened"
  | "database_migrated";

export const createDb = async (options?: {
  path?: string;
  onPhase?: (phase: DbOpenPhase) => void;
  signal?: AbortSignal;
}) => {
  const onPhase = options?.onPhase ?? (() => {});
  const requestedPath = resolveDbPath(options?.path);
  const dbPath = canonicalDbPath(requestedPath);

  const releaseLock = dbPath === ":memory:" ? () => {} : acquirePgliteLock(dbPath);

  let pglite: PGlite | undefined;
  try {
    onPhase("database_locked");
    options?.signal?.throwIfAborted();
    const embedded = getEmbeddedFiles();
    const pgliteOpts = await resolvePgliteOptions(embedded);
    onPhase("database_engine_loaded");
    if (dbPath !== ":memory:")
      await prepareCurrentPgliteHome({
        activePath: dbPath,
        runtime: pgliteOpts,
        embedded,
        signal: options?.signal,
        onImageRestored: () => onPhase("database_image_restored"),
        onPhase,
      });
    options?.signal?.throwIfAborted();
    pglite = await openPglite(dbPath, pgliteOpts, () => onPhase("database_image_restored"));
    const openedPglite = pglite;
    await openedPglite.waitReady;
    onPhase("database_opened");

    const db = drizzle(openedPglite, { schema });
    await withMigrationsFolder(async (migrationsFolder) => {
      if (!fs.existsSync(migrationsFolder)) return;
      const legacy = await openedPglite.query<{ legacy: boolean }>(
        "SELECT to_regclass('public.projects') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'root_path') AS legacy",
      );
      if (legacy.rows[0]?.legacy) await migrateThrough(db, migrationsFolder, 31);
      await prepareWorkspaceLocations(openedPglite);
      await removeSharedWorkspaceFolders(openedPglite, db, migrationsFolder);
      await prepareBoardViewRules(openedPglite);
      await removeArchivedWorkspaces(openedPglite);
      await migrateThrough(db, migrationsFolder);
      await finishBoardViewRules(openedPglite);
      await migrateWorkspaceCapabilities(openedPglite);
      await snapshotLegacyQueuedRequests(db);
    });
    onPhase("database_migrated");

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
