import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { relativeEmbeddedFileName } from "pstdio-paths";

export type EmbeddedEngineFile = Blob & { name: string };
const required = [
  "pglite-export-worker.js",
  "pglite-previous/pglite.wasm",
  "pglite-previous/pglite.data",
  "pglite/pglite.wasm",
  "pglite/pglite.data",
  "pglite/icu.76.tgz",
];

export const resolveExportWorker = async (embedded: readonly EmbeddedEngineFile[]) => {
  const files = embedded.flatMap((file) => {
    const relative = relativeEmbeddedFileName(file.name, "pstdio-db/vendor");
    return relative === undefined ? [] : [{ file, relative }];
  });
  if (!files.length)
    return { entry: join(import.meta.dirname, "pglite-export-worker.ts"), assets: undefined, dispose: async () => {} };
  const names = new Set(files.map(({ relative }) => relative));
  for (const name of required) if (!names.has(name)) throw new Error(`Partial PGlite export embed: missing ${name}`);
  const directory = await mkdtemp(join(tmpdir(), "pstdio-engine-assets-"));
  const dispose = () => rm(directory, { recursive: true, force: true });
  try {
    for (const { file, relative } of files) {
      if (relative === "pglite/initial-database.tar.gz") continue;
      const path = join(directory, relative);
      await mkdir(dirname(path), { recursive: true });
      await Bun.write(path, file);
    }
    return { entry: join(directory, "pglite-export-worker.js"), assets: directory, dispose };
  } catch (error) {
    await dispose();
    throw error;
  }
};
