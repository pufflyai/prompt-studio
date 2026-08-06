import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { normalizeEmbeddedFileName } from "pstdio-paths";
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

export const createDb = async (options?: { path?: string }) => {
  const requestedPath = resolveDbPath(options?.path);
  ensureDbDirectory(requestedPath);
  const dbPath = requestedPath === ":memory:" ? requestedPath : fs.realpathSync(requestedPath);

  const releaseLock = dbPath === ":memory:" ? () => {} : acquirePgliteLock(dbPath);

  try {
    const pgliteOpts = await resolvePgliteOptions();
    const pglite = dbPath === ":memory:" ? new PGlite(pgliteOpts) : new PGlite(dbPath, pgliteOpts);
    await pglite.waitReady;
    console.log("[createDb] PGlite ready");

    const db = drizzle(pglite, { schema });
    const migrationsFolder = await resolveMigrationsFolder();
    if (fs.existsSync(migrationsFolder)) {
      await migrate(db, { migrationsFolder });
    }

    let closed = false;
    const close = async () => {
      if (closed) {
        return;
      }

      closed = true;
      try {
        await pglite.close();
      } finally {
        releaseLock();
      }
    };

    return {
      close,
      db,
      path: dbPath,
      pglite,
    };
  } catch (error) {
    releaseLock();
    throw error;
  }
};

export type DbClient = PgliteDatabase<typeof schema>;
