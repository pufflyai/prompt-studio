import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { normalizeEmbeddedFileName } from "pstdio-paths";

export type EmbeddedEngineFile = Blob & { name: string };
const prefix = "../../pstdio-db/vendor/";
const required = [
  "pglite-upgrade-worker.js",
  "pglite-previous/pglite.wasm",
  "pglite-previous/pglite.data",
  "pglite/pglite.wasm",
  "pglite/pglite.data",
  "pglite/icu.76.tgz",
  "pglite/empty-database.tar.gz",
  "pglite-tools/dist/pg_dump.js",
  "pglite-tools/dist/pg_dump.wasm",
];

export const resolveUpgradeWorker = async (embedded: readonly EmbeddedEngineFile[]) => {
  const files = embedded.filter((file) => normalizeEmbeddedFileName(file.name).startsWith(prefix));
  if (!files.length)
    return { entry: join(import.meta.dirname, "pglite-upgrade-worker.ts"), assets: undefined, dispose: async () => {} };
  const names = new Set(files.map((file) => normalizeEmbeddedFileName(file.name).slice(prefix.length)));
  for (const name of required) if (!names.has(name)) throw new Error(`Partial PGlite upgrade embed: missing ${name}`);
  const directory = await mkdtemp(join(tmpdir(), "pstdio-engine-assets-"));
  const dispose = () => rm(directory, { recursive: true, force: true });
  try {
    for (const file of files) {
      const relative = normalizeEmbeddedFileName(file.name).slice(prefix.length);
      if (relative === "pglite/initial-database.tar.gz") continue;
      const path = join(directory, relative);
      await mkdir(dirname(path), { recursive: true });
      await Bun.write(path, file);
    }
    return { entry: join(directory, "pglite-upgrade-worker.js"), assets: directory, dispose };
  } catch (error) {
    await dispose();
    throw error;
  }
};
