import { readdirSync } from "node:fs";
import { PGlite, type PGliteOptions } from "@electric-sql/pglite";

export const openPglite = (dataDir: string, options: PGliteOptions = {}) => {
  if (dataDir === ":memory:") return new PGlite(options);
  const { loadDataDir, ...runtimeOptions } = options;
  // A nonempty directory may contain a damaged database. Never replace its files during startup.
  const empty = readdirSync(dataDir).length === 0;
  return new PGlite(dataDir, {
    ...runtimeOptions,
    loadDataDir: empty ? loadDataDir : undefined,
  });
};
