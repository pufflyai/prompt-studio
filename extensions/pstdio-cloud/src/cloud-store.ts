import { type AccountDevice, type AccountStatus, accountEvents, type ProjectSyncStatus } from "@pstdio/sdk/extensions";
import type { CloudClient } from "./cloud-context";

const accountOwner = (account: AccountStatus) =>
  account.login ? JSON.stringify([account.login.managerOrigin, account.login.accountId]) : undefined;

interface CloudData {
  account: AccountStatus;
  sync: ProjectSyncStatus;
  devices: AccountDevice[];
  signingIn: boolean;
  loginFailed: boolean;
}
interface ReadLoop {
  dirty: boolean;
  promise?: Promise<void>;
}
interface CloudSnapshot {
  data?: CloudData;
  error?: string;
}
type CloudReader = Pick<CloudClient, "events"> & {
  account: Pick<CloudClient["account"], "status" | "projectSyncStatus" | "devices">;
};

const readAccount = async (client: CloudReader, projectId?: string) => {
  const [account, sync] = await Promise.all([
    client.account.status(),
    projectId
      ? client.account.projectSyncStatus(projectId)
      : Promise.resolve({ state: "local" as const, offlineReady: true }),
  ]);
  return {
    account,
    sync,
    signingIn: account.loginAttempt?.status === "pending",
    loginFailed: account.loginAttempt?.status === "failed",
  };
};

export const createCloudStore = (client: CloudReader, projectId: string | undefined, includeDevices: boolean) => {
  let snapshot: CloudSnapshot = {};
  let generation = 0;
  let reading: ReadLoop | undefined;
  let deviceGeneration = 0;
  let devicesDirty = true;
  let subscriptions: (() => void)[] = [];
  let deviceOwner: string | undefined;
  let owner: string | undefined;
  let devices: AccountDevice[] = [];
  const listeners = new Set<() => void>();
  const publish = (next: CloudSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  const readDevices = async (expectedOwner: string) => {
    devicesDirty = false;
    const request = ++deviceGeneration;
    const current = () =>
      listeners.size > 0 &&
      request === deviceGeneration &&
      !!snapshot.data &&
      accountOwner(snapshot.data.account) === expectedOwner;
    try {
      const loaded = await client.account.devices();
      if (!current() || !snapshot.data) return;
      devices = loaded;
      deviceOwner = expectedOwner;
      publish({ ...snapshot, data: { ...snapshot.data, devices } });
    } catch (cause) {
      if (current()) publish({ ...snapshot, error: String(cause) });
    }
  };
  const readSnapshot = async () => {
    const request = ++generation;
    const current = () => listeners.size > 0 && request === generation;
    try {
      const next = await readAccount(client, projectId);
      if (!current()) return;
      const nextOwner = accountOwner(next.account);
      if (owner !== nextOwner) {
        deviceGeneration++;
        devicesDirty = true;
        deviceOwner = undefined;
        devices = [];
        owner = nextOwner;
      }
      publish({ data: { ...next, devices } });
      if (includeDevices && nextOwner && (devicesDirty || deviceOwner !== nextOwner)) void readDevices(nextOwner);
    } catch (cause) {
      if (current()) publish({ ...snapshot, error: String(cause) });
    }
  };
  const read = () => {
    generation++;
    if (reading) {
      reading.dirty = true;
      return reading.promise;
    }
    const pending: ReadLoop = { dirty: true };
    reading = pending;
    const run = async () => {
      while (reading === pending && pending.dirty && listeners.size) {
        pending.dirty = false;
        await readSnapshot();
      }
    };
    pending.promise = run().finally(() => {
      if (reading !== pending) return;
      reading = undefined;
      if (pending.dirty && listeners.size) void read();
    });
    return pending.promise;
  };
  const refresh = () => {
    devicesDirty = true;
    void read();
  };
  return {
    get: () => snapshot,
    refresh,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) {
        subscriptions = [
          client.events.subscribe(accountEvents.changed, refresh),
          client.events.subscribe(accountEvents.projectSyncChanged, () => void read()),
        ];
        refresh();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size) return;
        generation++;
        deviceGeneration++;
        reading = undefined;
        for (const unsubscribe of subscriptions) unsubscribe();
        subscriptions = [];
      };
    },
  };
};
