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

const DRIZZLE_PREFIX = "../../pstdio-db/drizzle/";

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

const resolveMigrationsFolder = async () => {
  const embedded = getEmbeddedFiles().filter((f) => f.name.startsWith(DRIZZLE_PREFIX));

  if (embedded.length > 0) {
    const root = path.join(os.tmpdir(), "pstdio-drizzle");
    if (!fs.existsSync(path.join(root, "meta"))) {
      for (const file of embedded) {
        const relativePath = file.name.slice(DRIZZLE_PREFIX.length);
        const outPath = path.join(root, relativePath);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        console.log(`[drizzle] extracting ${relativePath} (${file.size} bytes)`);
        const buf = await file.arrayBuffer();
        fs.writeFileSync(outPath, Buffer.from(buf));
      }
    }
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

const acquireDbLock = (dbPath: string) => {
  if (dbPath === ":memory:") {
    return null;
  }

  const lockPath = `${dbPath}.lock`;

  try {
    const fd = fs.openSync(lockPath, "wx");
    fs.writeFileSync(
      fd,
      JSON.stringify({
        pid: process.pid,
        createdAt: new Date().toISOString(),
      }),
    );

    return {
      release: () => {
        fs.closeSync(fd);
        fs.rmSync(lockPath, { force: true });
      },
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`Database path "${dbPath}" is already in use.`);
    }

    throw error;
  }
};

export const createDb = async (options?: { path?: string }) => {
  const dbPath = resolveDbPath(options?.path);
  console.log("[createDb] dbPath:", dbPath);

  ensureDbDirectory(dbPath);
  console.log("[createDb] ensured db directory");

  const lock = acquireDbLock(dbPath);
  let pglite: PGlite | null = null;

  try {
    const pgliteOpts = await resolvePgliteOptions();
    console.log("[createDb] pglite options resolved, keys:", Object.keys(pgliteOpts));

    pglite = dbPath === ":memory:" ? new PGlite(pgliteOpts) : new PGlite(dbPath, pgliteOpts);
    console.log("[createDb] PGlite constructor called, waiting for ready...");
    await pglite.waitReady;
    console.log("[createDb] PGlite ready");
    const client = pglite;

    const db = drizzle(client, { schema });
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

      try {
        await client.close();
      } finally {
        lock?.release();
      }
    };

    return {
      close,
      db,
      path: dbPath,
      pglite: client,
    };
  } catch (error) {
    if (pglite) {
      try {
        await pglite.close();
      } catch {
        // keep the original startup error
      }
    }

    lock?.release();
    throw error;
  }
};

export type DbClient = PgliteDatabase<typeof schema>;
