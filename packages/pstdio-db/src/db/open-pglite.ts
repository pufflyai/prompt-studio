import { readdirSync, renameSync, rmdirSync, rmSync } from "node:fs";
import { PGlite, type PGliteOptions } from "@electric-sql/pglite";

// The image is unpacked beside the data folder and moved in whole. A start that stops partway
// leaves the data folder empty, so the next start unpacks the image again.
const restoreInitialDatabase = async (dataDir: string, image: Blob) => {
  const staging = `${dataDir}.restoring`;
  rmSync(staging, { recursive: true, force: true });
  await new Bun.Archive(new Uint8Array(await image.arrayBuffer())).extract(staging);
  rmdirSync(dataDir);
  renameSync(staging, dataDir);
};

export const openPglite = async (dataDir: string, options: PGliteOptions = {}, onImageRestored = () => {}) => {
  const { loadDataDir, ...runtimeOptions } = options;
  if (dataDir === ":memory:") return new PGlite({ ...runtimeOptions, loadDataDir });
  // A nonempty directory may contain a damaged database. Never replace its files during startup.
  if (loadDataDir && readdirSync(dataDir).length === 0) {
    await restoreInitialDatabase(dataDir, loadDataDir);
    onImageRestored();
  }
  return new PGlite(dataDir, runtimeOptions);
};
