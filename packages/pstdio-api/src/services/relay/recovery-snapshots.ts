import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { apiLogger } from "../../lib/logger";

/** Runs independently of network sync, so a disconnected running device still keeps recovery points. */
export const startRecoverySnapshots = (input: {
  storage: ExtensionsRouteDeps["extensionStorageService"];
  projects: () => string[];
}) => {
  let running: Promise<void> | undefined;
  let closed = false;
  const capture = () => {
    if (closed) return Promise.resolve();
    if (!running)
      running = Promise.resolve().then(async () => {
        try {
          const projects = new Set([...(await input.storage.snapshots.projects()), ...input.projects()]);
          for (const projectId of projects) {
            if (closed) break;
            await input.storage.snapshots.capture(projectId).catch((error) => {
              apiLogger.warn(
                { event: "recovery.snapshot.failed", projectId, error },
                "Recovery snapshot unavailable; saved work is unchanged",
              );
            });
          }
        } catch (error) {
          apiLogger.warn(
            { event: "recovery.snapshot.failed", error },
            "Recovery history could not be read; capture will retry",
          );
        } finally {
          running = undefined;
        }
      });
    return running;
  };
  const timer = setInterval(() => void capture(), 60_000);
  timer.unref?.();
  return {
    capture,
    async close() {
      closed = true;
      clearInterval(timer);
      await running;
    },
  };
};
