import {
  type AccountDevice,
  type AccountStatus,
  accountEvents,
  createWebviewClient,
  type GuestHost,
  type ProjectSyncStatus,
} from "@pstdio/sdk/extensions";
import { createCloudQueries } from "./cloud-queries";

export const cloudAccount: AccountStatus = {
  login: { managerOrigin: "https://account.test", relayOrigin: "https://relay.test", accountId: "a", deviceId: "d" },
  features: { relay: true },
  cloudProjects: ["project"],
  cloudProjectsLoaded: true,
};
export const cloudDevice: AccountDevice = {
  id: "d",
  name: "Old",
  platform: "fixture",
  createdAt: "2026-11-05T00:00:00Z",
  lastSeenAt: "2026-11-05T00:00:00Z",
  online: true,
  current: true,
};
export const cloudQueryFixture = (projectId: string | undefined = "project") => {
  let account = cloudAccount;
  let sync: ProjectSyncStatus = { state: "synced", offlineReady: true };
  let devices = [cloudDevice];
  let props = {
    projectId,
    queryScope: {
      runtimeId: "cloud-fixture",
      accountId: "a",
      accountOrigin: "https://account.test",
    },
  };
  const listeners = new Set<(event: unknown) => void>();
  const propsListeners = new Set<(props: unknown) => void>();
  const reads = { status: 0, sync: 0, devices: 0 };
  const statusReplies: (() => Promise<AccountStatus>)[] = [];
  const deviceReplies: (() => Promise<AccountDevice[]>)[] = [];
  const stops: (() => void)[] = [];
  const host = {
    extensionId: "pstdio.pstdio-cloud",
    propsStore: {
      get: () => props,
      subscribe: (listener: (props: unknown) => void) => {
        propsListeners.add(listener);
        return () => {
          propsListeners.delete(listener);
        };
      },
    },
    onEvent: (_scope: string, listener: (event: unknown) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    call: async (_method: string, input: { op: string }) => {
      if (input.op === "status") {
        reads.status++;
        return statusReplies.shift()?.() ?? account;
      }
      if (input.op === "projectSyncStatus") {
        reads.sync++;
        return sync;
      }
      if (input.op === "devices") {
        reads.devices++;
        return deviceReplies.shift()?.() ?? devices;
      }
      throw new Error("Unexpected capability");
    },
  } as unknown as GuestHost;
  const client = createWebviewClient(host);
  const queries = createCloudQueries(client, projectId);
  const observe = <T>(query: import("@pstdio/sdk/extensions").ScopedQuery<T>) => {
    const stop = query.subscribe(() => {});
    stops.push(stop);
    return stop;
  };
  const hold = <T>(queue: (() => Promise<T>)[]) => {
    const pending = Promise.withResolvers<T>();
    queue.push(() => pending.promise);
    return pending;
  };
  return {
    client,
    queries,
    reads,
    observe,
    holdStatus: () => hold(statusReplies),
    holdDevices: () => hold(deviceReplies),
    failDevices: () => {
      deviceReplies.push(async () => {
        throw new Error("New manager unavailable");
      });
    },
    setAccount: (next: AccountStatus) => {
      account = next;
    },
    setSync: (next: ProjectSyncStatus) => {
      sync = next;
    },
    setDevices: (next: AccountDevice[]) => {
      devices = next;
    },
    emit: (id: string, projectId?: string) => {
      for (const listener of listeners) listener({ type: "changed", id, ...(projectId ? { projectId } : {}) });
    },
    accountChanged() {
      for (const listener of listeners) listener({ type: "changed", id: accountEvents.changed.id });
    },
    authority: (accountId: string, accountOrigin: string) => {
      props = { ...props, queryScope: { ...props.queryScope, accountId, accountOrigin } };
      for (const listener of propsListeners) listener(props);
    },
    async open() {
      observe(queries.snapshot);
      await queries.snapshot.read();
    },
    async devices() {
      const query = queries.devices(queries.snapshot.getSnapshot().data!.account.login!);
      observe(query);
      await query.read();
      return query;
    },
    detach() {
      for (const stop of stops.splice(0)) stop();
    },
    dispose() {
      for (const stop of stops.splice(0)) stop();
      client.queries.dispose();
    },
  };
};
