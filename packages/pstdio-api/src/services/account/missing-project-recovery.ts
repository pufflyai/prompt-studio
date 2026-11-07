import { apiLogger } from "../../lib/logger";
import type { RelayWorkbench } from "../relay/runtime";

/**
 * Creates cloud projects that this device does not have yet. Recovery can wait on the relay and on
 * extension installs, so it runs beside the account refresh and never holds up the projects already here.
 */
export const createMissingProjectRecovery = (input: {
  exists: (projectId: string) => Promise<boolean>;
  /** Refresh relay admission when the project row or its setup readiness changes. */
  recovered: () => void;
}) => {
  // Until the relay runtime starts, nothing can be recovered.
  let recover: (connection: RelayWorkbench, signal: AbortSignal, created: () => void) => Promise<void> = async () => {};
  const shutdown = new AbortController();
  let running: Promise<void> | undefined;
  let batch: { login: string | undefined; controller: AbortController } | undefined;
  let next: RelayWorkbench[] | undefined;
  // A project can download data during setup, but cannot be ready until this owner finishes.
  let current: string | undefined;
  const run = (connections: RelayWorkbench[]) => {
    const controller = new AbortController();
    const signal = AbortSignal.any([shutdown.signal, controller.signal]);
    batch = { login: connections[0]?.renewalGrant, controller };
    running = (async () => {
      for (const connection of connections) {
        if (signal.aborted) return;
        // A queued list can name a project that was created since. A failed lookup waits for the next refresh.
        if (await input.exists(connection.workbenchId).catch(() => true)) continue;
        let changed = false;
        current = connection.workbenchId;
        await recover(connection, signal, () => {
          if (signal.aborted) return;
          changed = true;
          input.recovered();
        }).catch((error: unknown) =>
          apiLogger.warn(
            { event: "account.cloud_project.recovery_failed", projectId: connection.workbenchId, error },
            "Recovery will retry",
          ),
        );
        current = undefined;
        // A failed recovery can still have created the project.
        if (await input.exists(connection.workbenchId).catch(() => false)) changed = true;
        // Drain rollback owners and release completed readiness before the next
        // project can wait on network or extension setup.
        if (changed && !signal.aborted) input.recovered();
      }
    })().finally(() => {
      current = undefined;
      running = undefined;
      const queued = next;
      next = undefined;
      if (queued?.length && !shutdown.signal.aborted) run(queued);
    });
  };
  return {
    start(recoverProject: typeof recover) {
      recover = recoverProject;
    },
    recovering: (projectId: string) => current === projectId,
    // One at a time: the first recovered project on a fresh device installs the default extensions.
    // A newer list waits for the running one. Signing out or in with another account stops it.
    // A project that cannot be recovered yet is tried again with the next list.
    recover(connections: RelayWorkbench[]) {
      if (!running) {
        if (connections.length) run(connections);
        return;
      }
      if (batch?.login !== connections[0]?.renewalGrant) batch?.controller.abort();
      next = connections;
    },
    async close() {
      shutdown.abort();
      await running;
    },
  };
};
