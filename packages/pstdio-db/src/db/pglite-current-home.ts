import { mkdir, rename, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { PGliteOptions } from "@electric-sql/pglite";
import { restoreInitialDatabase } from "./open-pglite";
import { type EmbeddedEngineFile, resolveExportWorker } from "./pglite-export-assets";
import { ExportInterruptedError, runExportWorker } from "./pglite-export-process";
import { preparePgliteHome } from "./pglite-home-recovery";

export type PgliteRetirementPhase = "database_retiring" | "database_retired";

/** Where a home from another release goes: `backups/pre-0.46-<time>/` next to the database. */
export const retiredHomePath = (activePath: string, now = new Date()) =>
  join(dirname(activePath), "backups", `pre-0.46-${now.toISOString().replaceAll(":", "-")}`);

export const prepareCurrentPgliteHome = async (options: {
  activePath: string;
  runtime: PGliteOptions;
  embedded: readonly EmbeddedEngineFile[];
  signal?: AbortSignal;
  onImageRestored: () => void;
  onPhase?: (phase: PgliteRetirementPhase) => void;
}) => {
  await preparePgliteHome({
    activePath: options.activePath,
    signal: options.signal,
    retire: async (active) => {
      options.onPhase?.("database_retiring");
      const backup = retiredHomePath(active);
      await mkdir(backup, { recursive: true });
      const worker = await resolveExportWorker(options.embedded);
      try {
        const args = [active, join(backup, "export"), ...(worker.assets ? [worker.assets] : [])];
        await runExportWorker({ entry: worker.entry, args, signal: options.signal });
      } catch (error) {
        // A stopped export runs again on the next start, so the home stays and the partial backup goes.
        if (options.signal?.aborted || error instanceof ExportInterruptedError) {
          await rm(backup, { recursive: true, force: true });
          throw options.signal?.aborted ? options.signal.reason : error;
        }
        // The original folder is kept either way, so a failed export must not keep people out of the app.
        await Bun.write(
          join(backup, "export-error.txt"),
          error instanceof Error ? (error.stack ?? error.message) : String(error),
        );
      } finally {
        await worker.dispose();
      }
      await rename(active, join(backup, "database"));
      options.onPhase?.("database_retired");
    },
    prepare: async ({ target }) => {
      options.signal?.throwIfAborted();
      await mkdir(target);
      // The matching engine already initialized and verified this immutable image at build time.
      // Publish the complete snapshot before starting the one active runtime engine.
      if (!options.runtime.loadDataDir) throw new Error("First creation requires the built database image");
      await restoreInitialDatabase(target, options.runtime.loadDataDir);
      options.onImageRestored();
      options.signal?.throwIfAborted();
    },
  });
};
