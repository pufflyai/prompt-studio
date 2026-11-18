import { apiLogger } from "../../lib/logger";
import type { RelayWorkbench } from "../relay/runtime";

export const partitionCloudProjects = async (
  ids: string[],
  withdrawn: ReadonlySet<string>,
  exists: (id: string) => Promise<unknown>,
  recovering: (id: string) => boolean,
) => {
  const local: string[] = [];
  const absent: string[] = [];
  for (const id of ids) {
    if (withdrawn.has(id)) continue;
    const present = await exists(id);
    if (present) local.push(id);
    // Keep the in-flight recovery in its account batch so refresh cannot cancel setup.
    if (!present || recovering(id)) absent.push(id);
  }
  return { local, absent };
};

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
  let selected: RelayWorkbench[] | undefined;
  // A project can download data during setup, but cannot be ready until this owner finishes.
  let current: string | undefined;
  const recoverOne = async (connection: RelayWorkbench, signal: AbortSignal) => {
    // A queued list can name a project that was created since. A failed lookup waits for the next refresh.
    const exists = await input.exists(connection.workbenchId).catch(() => true);
    if (exists || signal.aborted) return;
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
    // Release completed readiness before another project can wait on network or extension setup.
    const created = await input.exists(connection.workbenchId).catch(() => false);
    if ((changed || created) && !signal.aborted) input.recovered();
  };
  const run = (connections: RelayWorkbench[]) => {
    const controller = new AbortController();
    const signal = AbortSignal.any([shutdown.signal, controller.signal]);
    selected = connections;
    batch = { login: connections[0]?.renewalGrant, controller };
    running = (async () => {
      for (const connection of connections) {
        if (signal.aborted) return;
        await recoverOne(connection, signal);
      }
    })().finally(() => {
      current = undefined;
      running = undefined;
      selected = undefined;
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
      if (
        batch?.login !== connections[0]?.renewalGrant ||
        (current && !connections.some((connection) => connection.workbenchId === current))
      )
        batch?.controller.abort();
      next = connections;
    },
    async withdraw(id: string) {
      if (next) next = next.filter(({ workbenchId }) => workbenchId !== id);
      if (!selected?.some(({ workbenchId }) => workbenchId === id)) return;
      const drained = running;
      next ??= selected.filter(({ workbenchId }) => workbenchId !== id);
      batch?.controller.abort();
      await drained;
    },
    async close() {
      shutdown.abort();
      await running;
    },
  };
};
