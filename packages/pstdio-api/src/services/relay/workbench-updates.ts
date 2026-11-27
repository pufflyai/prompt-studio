import { createLiveConnection, type LiveConnection } from "pstdio-sync/relay";
import { canonicalJson } from "pstdio-sync-contracts";
import type { RelayDeps } from "./deps";
import type { startRelayExtension } from "./extension-owner";
import { createNativeRelayAccess } from "./native-relay-access";
import type { RelayWorkbench } from "./runtime";

type ExtensionConnection = Awaited<ReturnType<typeof startRelayExtension>>;
// Drain every start before another refresh can admit owners from a newer snapshot.
export const drainOwnerStarts = async (starts: Promise<void>[]) => {
  const results = await Promise.allSettled(starts);
  for (const result of results) if (result.status === "rejected") throw result.reason;
};

export const createWorkbenchAccess = (input: RelayWorkbench, runtime: AbortSignal, denied?: () => void) => {
  const owner = new AbortController();
  const signal = AbortSignal.any([runtime, owner.signal]);
  const renew = createNativeRelayAccess({ ...input, signal, denied });
  let socketLease: Awaited<ReturnType<typeof renew>> | undefined;
  const connect = async () => {
    socketLease = await renew();
    return socketLease;
  };
  const access = async () => {
    if (!input.userId) return renew();
    signal.throwIfAborted();
    // Team writes use the same lease as their live connection. An old sync pass cannot get
    // a newly signed token while it still holds the keys from the preceding lease.
    if (!socketLease || Date.now() >= Date.parse(socketLease.expiresAt))
      throw new Error("Team Cloud connection is renewing");
    return socketLease;
  };
  return Object.assign(access, { connect, close: () => owner.abort() });
};

const closeWorkbenchOwners = (
  id: string,
  owners: { remove(id: string): Promise<void> }[],
  live: Map<string, LiveConnection>,
) => {
  const pending = owners.map((owner) => owner.remove(id));
  const channel = live.get(id);
  channel?.close();
  live.delete(id);
  return drainOwnerStarts([...pending, Promise.resolve(channel?.done).then(() => {})]);
};

interface WorkbenchUpdateInput {
  deps: RelayDeps;
  workbenches: Map<string, RelayWorkbench>;
  access: Map<string, ReturnType<typeof createWorkbenchAccess>>;
  live: Map<string, LiveConnection>;
  connections: Map<string, ExtensionConnection>;
  lifecycleOwners: { remove(id: string): Promise<void> }[];
  stopConnection(key: string, connection: ExtensionConnection): Promise<void>;
  signal: AbortSignal;
  statusChanged(id: string): void;
  refresh(): Promise<void>;
  denied?: () => void;
}
export const createWorkbenchUpdates = (input: WorkbenchUpdateInput) => {
  const {
    deps,
    workbenches,
    access,
    live,
    connections,
    lifecycleOwners,
    stopConnection,
    signal,
    statusChanged,
    refresh,
    denied,
  } = input;
  // Replaces the synced workbenches. Only workbenches whose login changed restart their connections.
  const update = async (next: RelayWorkbench[]) => {
    await deps.personalHistoryService.refreshIdentity();
    const admitted = await Promise.all(
      next.map(async (connection) =>
        (await deps.accountService.acceptsRelayWorkbench(connection)) ? connection : undefined,
      ),
    );
    const desired = new Map(
      admitted
        .filter((connection): connection is RelayWorkbench => Boolean(connection))
        .filter((connection) => !deps.projectService.work.hidden(connection.workbenchId))
        .map((connection) => [connection.workbenchId, connection]),
    );
    const changed = new Set(
      [...workbenches]
        .filter(([id, current]) => canonicalJson(desired.get(id) ?? null) !== canonicalJson(current))
        .map(([id]) => id),
    );
    // Events emitted while owners drain must not recreate them on the old shared connection.
    for (const id of changed) {
      workbenches.delete(id);
      access.get(id)?.close();
      access.delete(id);
    }
    const obsolete = [...connections].filter(([, active]) => changed.has(active.owner.workbenchId));
    await drainOwnerStarts([
      ...[...changed].map((id) => closeWorkbenchOwners(id, lifecycleOwners, live)),
      ...obsolete.map(([key, active]) => stopConnection(key, active)),
    ]);
    for (const [id, connection] of desired)
      if (!workbenches.has(id)) {
        workbenches.set(id, connection);
        const workbenchAccess = createWorkbenchAccess(connection, signal, denied);
        access.set(id, workbenchAccess);
        const channel = createLiveConnection({
          origin: connection.relayOrigin,
          projectId: id,
          access: workbenchAccess.connect,
          restartSyncOnRenewal: !!connection.userId,
          signal: signal,
          onStatusChange: () => statusChanged(id),
        });
        channel.discover(connection.userId ?? connection.accountId);
        live.set(id, channel);
      }
    for (const id of changed) statusChanged(id);
    await refresh();
  };
  let updates = Promise.resolve();
  const queueUpdate = (connections: () => RelayWorkbench[]) => {
    const pending = updates.then(() => update(connections()));
    updates = pending.catch(() => {});
    return pending;
  };
  return {
    update: (next: RelayWorkbench[]) => queueUpdate(() => next),
    withdraw: (id: string) =>
      queueUpdate(() => [...workbenches.values()].filter(({ workbenchId }) => workbenchId !== id)),
    done: () => updates,
  };
};
