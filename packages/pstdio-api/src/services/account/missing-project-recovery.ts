import { apiLogger } from "../../lib/logger";
import type { RelayWorkbench } from "../relay/runtime";

/**
 * Creates cloud projects that this device does not have yet. Recovery can wait on the relay and on
 * extension installs, so it runs beside the account refresh and never holds up the projects already here.
 */
export const createMissingProjectRecovery = (input: {
  exists: (projectId: string) => Promise<boolean>;
  /** Called after a project was created, so it starts syncing. */
  recovered: () => void;
}) => {
  // Until the relay runtime starts, nothing can be recovered.
  let recover: (connection: RelayWorkbench, signal: AbortSignal) => Promise<void> = async () => {};
  const shutdown = new AbortController();
  let running: Promise<void> | undefined;
  return {
    start(recoverProject: typeof recover) {
      recover = recoverProject;
    },
    // One at a time: the first recovered project on a fresh device installs the default extensions.
    // A project that cannot be recovered yet is tried again with the next list.
    recover(connections: RelayWorkbench[]) {
      if (running) return;
      running = (async () => {
        let created = false;
        for (const connection of connections) {
          if (shutdown.signal.aborted) return;
          await recover(connection, shutdown.signal).catch((error: unknown) =>
            apiLogger.warn(
              { event: "account.cloud_project.recovery_failed", projectId: connection.workbenchId, error },
              "Recovery will retry",
            ),
          );
          // A failed recovery can still have created the project. A failed lookup waits for the next refresh.
          if (await input.exists(connection.workbenchId).catch(() => false)) created = true;
        }
        if (created && !shutdown.signal.aborted) input.recovered();
      })().finally(() => {
        running = undefined;
      });
    },
    async close() {
      shutdown.abort();
      await running;
    },
  };
};
