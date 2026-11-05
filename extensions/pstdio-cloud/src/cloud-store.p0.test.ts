import { expect, test } from "bun:test";
import {
  type AccountDevice,
  type AccountStatus,
  accountEvents,
  type ProjectSyncStatus,
  type WebviewEventsClient,
} from "@pstdio/sdk/extensions";
import { createCloudStore } from "./cloud-store";

const account: AccountStatus = {
  login: { managerOrigin: "https://account.test", relayOrigin: "https://relay.test", accountId: "a", deviceId: "d" },
  features: { relay: true },
  cloudProjects: ["project"],
  cloudProjectsLoaded: true,
};
const device: AccountDevice = {
  id: "d",
  name: "old",
  platform: "fixture",
  createdAt: "2026-11-05T00:00:00Z",
  lastSeenAt: "2026-11-05T00:00:00Z",
  online: true,
  current: true,
};

test("sync notifications cannot discard a device refresh after a rename", async () => {
  const listeners = new Map<string, Set<() => void>>();
  const events: WebviewEventsClient = {
    subscribe(event, listener) {
      const id = typeof event === "string" ? event : event.id;
      const group = listeners.get(id) ?? new Set();
      listeners.set(id, group);
      group.add(listener);
      return () => {
        group.delete(listener);
      };
    },
  };
  let sync: ProjectSyncStatus = { state: "synced", offlineReady: true };
  let reads = 0;
  const requested = Promise.withResolvers<void>();
  const released = Promise.withResolvers<AccountDevice[]>();
  const store = createCloudStore(
    {
      account: {
        status: async () => account,
        projectSyncStatus: async () => sync,
        async devices() {
          if (reads++ === 0) return [device];
          requested.resolve();
          return released.promise;
        },
      },
      events,
    },
    "project",
    true,
  );
  const until = (predicate: () => boolean) => {
    const ready = Promise.withResolvers<void>();
    const remove = store.subscribe(() => {
      if (predicate()) {
        remove();
        ready.resolve();
      }
    });
    if (predicate()) {
      remove();
      ready.resolve();
    }
    return ready.promise;
  };
  const unsubscribe = store.subscribe(() => {});
  try {
    await until(() => store.get().data?.devices.length === 1);
    store.refresh();
    await requested.promise;
    sync = { state: "offline", offlineReady: true };
    for (const listener of listeners.get(accountEvents.projectSyncChanged.id) ?? []) listener();
    await until(() => store.get().data?.sync.state === "offline");
    released.resolve([{ ...device, name: "renamed" }]);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(store.get().data?.devices[0]?.name).toBe("renamed");
    expect(store.get().data?.sync.state).toBe("offline");
  } finally {
    released.resolve([]);
    unsubscribe();
  }
});

test("sync notifications preserve a device refresh while account status is pending", async () => {
  const listeners = new Map<string, () => void>();
  const delayed = Promise.withResolvers<AccountStatus>();
  const requested = Promise.withResolvers<void>();
  let pauseAccount = false;
  let devices = [device];
  let reads = 0;
  const store = createCloudStore(
    {
      events: {
        subscribe(event, listener) {
          const id = typeof event === "string" ? event : event.id;
          listeners.set(id, listener);
          return () => {
            listeners.delete(id);
          };
        },
      },
      account: {
        status: async () => {
          if (!pauseAccount) return account;
          pauseAccount = false;
          requested.resolve();
          return delayed.promise;
        },
        projectSyncStatus: async () => ({ state: "synced", offlineReady: true }),
        devices: async () => {
          reads++;
          return devices;
        },
      },
    },
    "project",
    true,
  );
  const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
  const unsubscribe = store.subscribe(() => {});
  try {
    await tick();
    expect(store.get().data?.devices[0]?.name).toBe("old");
    devices = [{ ...device, name: "renamed" }];
    pauseAccount = true;
    store.refresh();
    await requested.promise;
    listeners.get(accountEvents.projectSyncChanged.id)!();
    await tick();
    delayed.resolve(account);
    await tick();
    expect(store.get().data?.devices[0]?.name).toBe("renamed");
    expect(reads).toBe(2);
  } finally {
    delayed.resolve(account);
    unsubscribe();
  }
});

test("a different account manager cannot retain devices from the previous account", async () => {
  let current = account;
  let reads = 0;
  let changed = () => {};
  const store = createCloudStore(
    {
      events: {
        subscribe(event, listener) {
          if ((typeof event === "string" ? event : event.id) === accountEvents.changed.id) changed = listener;
          return () => {};
        },
      },
      account: {
        status: async () => current,
        projectSyncStatus: async () => ({ state: "local", offlineReady: true }),
        devices: async () => {
          if (reads++ === 0) return [device];
          throw new Error("new manager unavailable");
        },
      },
    },
    "project",
    true,
  );
  const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
  const unsubscribe = store.subscribe(() => {});
  try {
    await tick();
    expect(store.get().data?.devices).toEqual([device]);
    current = { ...account, login: { ...account.login!, managerOrigin: "https://second.test" } };
    changed();
    await tick();
    expect(store.get().data?.account.login?.managerOrigin).toBe("https://second.test");
    expect(store.get().data?.devices).toEqual([]);
    expect(store.get().error).toContain("new manager unavailable");
  } finally {
    unsubscribe();
  }
});
