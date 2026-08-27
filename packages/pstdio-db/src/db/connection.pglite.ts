import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { normalizeEmbeddedFileName } from "pstdio-paths";
import {
  ensureLegacyTemplateOwners,
  hasLegacyTemplatesTable,
  migrateLegacyTemplates,
} from "./legacy-template-migration";
import { ensureDbDirectory, resolveDbPath } from "./paths";
import { acquirePgliteLock } from "./pglite-lock";
import * as schema from "./schemas.pg";

type EmbeddedFile = Blob & { name: string };
// Bun's embedded file objects are runtime-specific; narrowing the contract keeps extraction testable
// without depending on full Blob behavior that unit tests do not control.
type EmbeddedMigrationFile = Pick<EmbeddedFile, "name" | "size" | "arrayBuffer">;

const DRIZZLE_PREFIX = "../../pstdio-db/drizzle/";
const DRIZZLE_EXTRACT_DIR = "pstdio-drizzle";
const PGLITE_WASM_SUFFIX = "/pstdio-db/vendor/pglite/pglite.wasm";
const PGLITE_DATA_SUFFIX = "/pstdio-db/vendor/pglite/pglite.data";
const LEGACY_TEMPLATE_STORAGE_MIGRATION = 17;

const migrateThroughLegacyTemplateStorage = async (db: PgliteDatabase<typeof schema>, migrationsFolder: string) => {
  const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pstdio-template-migrations-"));
  const stageMeta = path.join(stageRoot, "meta");
  fs.mkdirSync(stageMeta);
  try {
    const journalPath = path.join(migrationsFolder, "meta/_journal.json");
    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    const entries = journal.entries.filter((entry) => entry.idx <= LEGACY_TEMPLATE_STORAGE_MIGRATION);
    fs.writeFileSync(path.join(stageMeta, "_journal.json"), JSON.stringify({ ...journal, entries }));
    for (const entry of entries) {
      fs.copyFileSync(path.join(migrationsFolder, `${entry.tag}.sql`), path.join(stageRoot, `${entry.tag}.sql`));
    }
    await migrate(db, { migrationsFolder: stageRoot });
  } finally {
    fs.rmSync(stageRoot, { force: true, recursive: true });
  }
};

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
  const embedded = embeddedSource.filter((file) => normalizeEmbeddedFileName(file.name).startsWith(DRIZZLE_PREFIX));

  if (embedded.length > 0) {
    const root = path.join(options.tmpDir ?? os.tmpdir(), DRIZZLE_EXTRACT_DIR);
    fs.rmSync(root, { recursive: true, force: true });
    await extractEmbeddedMigrations(embedded, root, options.logger ?? console.log);
    return root;
  }

  return path.join(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle");
};

export const resolvePgliteOptions = async (embeddedFiles: readonly EmbeddedFile[] = getEmbeddedFiles()) => {
  const wasmFile = embeddedFiles.find((file) => normalizeEmbeddedFileName(file.name).endsWith(PGLITE_WASM_SUFFIX));
  const dataFile = embeddedFiles.find((file) => normalizeEmbeddedFileName(file.name).endsWith(PGLITE_DATA_SUFFIX));

  if (!wasmFile && !dataFile) return {};
  if (!wasmFile || !dataFile) {
    throw new Error(
      `Partial PGlite embed: expected both *${PGLITE_WASM_SUFFIX} and *${PGLITE_DATA_SUFFIX} in embedded files.`,
    );
  }

  const wasmBytes = await wasmFile.arrayBuffer();
  const wasmModule = await WebAssembly.compile(wasmBytes);

  return { fsBundle: dataFile, wasmModule };
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
    pglite = dbPath === ":memory:" ? new PGlite(pgliteOpts) : new PGlite(dbPath, pgliteOpts);
    const openedPglite = pglite;
    await openedPglite.waitReady;
    console.log("[createDb] PGlite ready");

    const db = drizzle(openedPglite, { schema });
    const migrationsFolder = await resolveMigrationsFolder();
    if (fs.existsSync(migrationsFolder)) {
      if (await hasLegacyTemplatesTable(openedPglite)) {
        const storage = await openedPglite.query<{ extension_files: string | null }>(
          "SELECT to_regclass('public.extension_files')::text AS extension_files",
        );
        if (!storage.rows[0]?.extension_files) {
          await migrateThroughLegacyTemplateStorage(db, migrationsFolder);
        }
        await ensureLegacyTemplateOwners(openedPglite);
      }
      await migrateLegacyTemplates(openedPglite);
      await migrate(db, { migrationsFolder });
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
