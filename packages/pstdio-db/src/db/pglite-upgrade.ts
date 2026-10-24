import { cp, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { PGliteOptions } from "@electric-sql/pglite";
import { restoreInitialDatabase } from "./open-pglite";
import { preparePgliteHome } from "./pglite-home-recovery";
import { type EmbeddedEngineFile, resolveUpgradeWorker } from "./pglite-upgrade-assets";

import { runUpgradeWorker } from "./pglite-upgrade-process";

export type PgliteUpgradePhase =
  | "database_upgrade_copying"
  | "database_upgrade_exporting"
  | "database_upgrade_importing";

export const prepareCurrentPgliteHome = async (options: {
  activePath: string;
  runtime: PGliteOptions;
  embedded: readonly EmbeddedEngineFile[];
  signal?: AbortSignal;
  onImageRestored: () => void;
  onPhase?: (phase: PgliteUpgradePhase) => void;
}) => {
  await preparePgliteHome({
    activePath: options.activePath,
    signal: options.signal,
    prepare: async ({ source, target, work }) => {
      options.signal?.throwIfAborted();
      if (!source) {
        await mkdir(target);
        // The matching engine already initialized and verified this immutable image at build time.
        // Publish the complete snapshot before starting the one active runtime engine.
        if (!options.runtime.loadDataDir) throw new Error("First creation requires the built database image");
        await restoreInitialDatabase(target, options.runtime.loadDataDir);
        options.onImageRestored();
        options.signal?.throwIfAborted();
        return;
      }
      const worker = await resolveUpgradeWorker(options.embedded);
      try {
        const copy = join(work, "source");
        const archive = join(work, "archive");
        options.onPhase?.("database_upgrade_copying");
        await cp(source, copy, { recursive: true });
        const args = (phase: string, database: string) => [
          phase,
          database,
          archive,
          ...(worker.assets ? [worker.assets] : []),
        ];
        options.onPhase?.("database_upgrade_exporting");
        await runUpgradeWorker({ entry: worker.entry, args: args("export", copy), signal: options.signal });
        options.onPhase?.("database_upgrade_importing");
        await runUpgradeWorker({ entry: worker.entry, args: args("import", target), signal: options.signal });
      } finally {
        await worker.dispose();
      }
    },
  });
};
