import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
// @ts-expect-error Bun file import
import pgliteDataPath from "../../node_modules/@electric-sql/pglite/dist/pglite.data" with { type: "file" };
// Bun embedded file imports for compiled binary — these become $bunfs paths
// @ts-expect-error Bun file import
import pgliteWasmPath from "../../node_modules/@electric-sql/pglite/dist/pglite.wasm" with { type: "file" };
import { ensureDbDirectory, resolveDbPath } from "./paths";
import * as schema from "./schemas.pg";

type EmbeddedFile = Blob & { name: string };
// Bun's embedded file objects are runtime-specific; narrowing the contract keeps extraction testable
// without depending on full Blob behavior that unit tests do not control.
type EmbeddedMigrationFile = Pick<EmbeddedFile, "name" | "size" | "arrayBuffer">;

const DRIZZLE_PREFIX = "../../pstdio-db/drizzle/";
const DRIZZLE_EXTRACT_DIR = "pstdio-drizzle";

const getEmbeddedFiles = (): EmbeddedFile[] => {
  try {
    const files = (Bun as Record<string, unknown>).embeddedFiles;
    if (Array.isArray(files)) return files as EmbeddedFile[];
  } catch {
    // not available
  }
  return [];
};

const isCompiledBinary = () => getEmbeddedFiles().length > 0;

const extractEmbeddedMigrations = async (
  embeddedFiles: readonly EmbeddedMigrationFile[],
  root: string,
  logger: (message: string) => void,
) => {
  for (const file of embeddedFiles) {
    const relativePath = file.name.slice(DRIZZLE_PREFIX.length);
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
  const embedded = embeddedSource.filter((f) => f.name.startsWith(DRIZZLE_PREFIX));

  if (embedded.length > 0) {
    const root = path.join(options.tmpDir ?? os.tmpdir(), DRIZZLE_EXTRACT_DIR);
    fs.rmSync(root, { recursive: true, force: true });
    await extractEmbeddedMigrations(embedded, root, options.logger ?? console.log);
    return root;
  }

  return path.join(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle");
};

const resolvePgliteOptions = async () => {
  if (!isCompiledBinary()) return {};

  const wasmBytes = await Bun.file(pgliteWasmPath).arrayBuffer();
  const wasmModule = await WebAssembly.compile(wasmBytes);
  const fsBundle = Bun.file(pgliteDataPath);

  return { fsBundle, wasmModule };
};

export const createDb = async (options?: { path?: string }) => {
  const dbPath = resolveDbPath(options?.path);
  console.log("[createDb] dbPath:", dbPath);

  ensureDbDirectory(dbPath);
  console.log("[createDb] ensured db directory");

  const pgliteOpts = await resolvePgliteOptions();
  console.log("[createDb] pglite options resolved, keys:", Object.keys(pgliteOpts));

  const pglite = dbPath === ":memory:" ? new PGlite(pgliteOpts) : new PGlite(dbPath, pgliteOpts);
  console.log("[createDb] PGlite constructor called, waiting for ready...");
  await pglite.waitReady;
  console.log("[createDb] PGlite ready");

  const db = drizzle(pglite, { schema });
  const migrationsFolder = await resolveMigrationsFolder();
  console.log("[createDb] migrations folder:", migrationsFolder);
  if (fs.existsSync(migrationsFolder)) {
    await migrate(db, { migrationsFolder });
    console.log("[createDb] migrations applied");
  }

  let closed = false;
  const close = async () => {
    if (closed) {
      return;
    }

    closed = true;
    await pglite.close();
  };

  return {
    close,
    db,
    path: dbPath,
    pglite,
  };
};

export type DbClient = PgliteDatabase<typeof schema>;
