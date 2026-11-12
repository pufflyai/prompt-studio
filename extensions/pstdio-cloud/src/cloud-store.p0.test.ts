import { expect, test } from "bun:test";
import {
  type AccountDevice,
  type AccountStatus,
  accountEvents,
  type ProjectSyncStatus,
  type WebviewEventsClient,
} from "@pstdio/sdk/extensions";
import { createCloudStore } from "./cloud-store";

test("a visible Cloud subscription does not wait for a retired account read", async () => {
  const retired = Promise.withResolvers<AccountStatus>();
  let reads = 0;
  const store = createCloudStore(
    {
      events: { subscribe: () => () => {} },
      account: {
        status: () => (++reads === 1 ? retired.promise : Promise.resolve(account)),
        projectSyncStatus: async () => ({ state: "first-download-incomplete", offlineReady: false }),
        devices: async () => [],
      },
    },
    "project",
    false,
  );
  const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
  const hide = store.subscribe(() => {});
  await tick();
  hide();
  const close = store.subscribe(() => {});
  try {
    await tick();
    expect(reads).toBe(2);
    expect(store.get().data?.sync.state).toBe("first-download-incomplete");
    retired.resolve({ ...account, login: null });
    await tick();
    expect(store.get().data?.account).toEqual(account);
  } finally {
    retired.resolve(account);
    close();
  }
});

test("a retired Cloud read cannot release a newer pending read or consume its refresh", async () => {
  const retired = Promise.withResolvers<AccountStatus>();
  const current = Promise.withResolvers<AccountStatus>();
  let reads = 0;
  const store = createCloudStore(
    {
      events: { subscribe: () => () => {} },
      account: {
        status: () => {
          reads++;
          if (reads === 1) return retired.promise;
          if (reads === 2) return current.promise;
          return Promise.resolve(account);
        },
        projectSyncStatus: async () => ({ state: "first-download-incomplete", offlineReady: false }),
        devices: async () => [],
      },
    },
    "project",
    false,
  );
  const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
  const hide = store.subscribe(() => {});
  await tick();
  hide();
  const close = store.subscribe(() => {});
  try {
    await tick();
    expect(reads).toBe(2);
    retired.resolve({ ...account, login: null });
    await tick();
    store.refresh();
    await tick();
    expect(reads).toBe(2);
    expect(store.get().data).toBeUndefined();
    current.resolve({ ...account, login: null });
    await tick();
    expect(reads).toBe(3);
    expect(store.get().data?.account).toEqual(account);
  } finally {
    retired.resolve(account);
    current.resolve(account);
    close();
  }
});

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

test("sync event bursts coalesce pending reads and still publish the latest state", async () => {
  let changed = () => {};
  let reads = 0;
  const pending = Promise.withResolvers<AccountStatus>();
  let sync: ProjectSyncStatus = { state: "synced", offlineReady: true };
  const store = createCloudStore(
    {
      events: {
        subscribe(event, listener) {
          if ((typeof event === "string" ? event : event.id) === accountEvents.projectSyncChanged.id)
            changed = listener;
          return () => {};
        },
      },
      account: {
        status: async () => (++reads === 1 ? pending.promise : account),
        projectSyncStatus: async () => sync,
        devices: async () => [],
      },
    },
    "project",
    false,
  );
  const unsubscribe = store.subscribe(() => {});
  try {
    sync = { state: "offline", offlineReady: true };
    for (let index = 0; index < 50; index++) changed();
    expect(reads).toBe(1);
    pending.resolve(account);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(reads).toBe(2);
    expect(store.get().data?.sync.state).toBe("offline");
  } finally {
    pending.resolve(account);
    unsubscribe();
  }
});

test("queued account changes cannot publish an obsolete account with another account's devices", async () => {
  let changed = () => {};
  let accountReads = 0;
  let deviceReads = 0;
  const stale = Promise.withResolvers<AccountStatus>();
  const current = Promise.withResolvers<AccountStatus>();
  const nextAccount = { ...account, login: { ...account.login!, accountId: "b" } };
  const store = createCloudStore(
    {
      events: {
        subscribe(event, listener) {
          if ((typeof event === "string" ? event : event.id) === accountEvents.changed.id) changed = listener;
          return () => {};
        },
      },
      account: {
        status: async () => {
          accountReads++;
          if (accountReads === 2) return stale.promise;
          if (accountReads === 3) return current.promise;
          return account;
        },
        projectSyncStatus: async () => ({ state: "synced", offlineReady: true }),
        devices: async () => [{ ...device, name: ++deviceReads === 1 ? "Account A device" : "Account B device" }],
      },
    },
    "project",
    true,
  );
  const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
  const unsubscribe = store.subscribe(() => {});
  try {
    await tick();
    store.refresh();
    changed();
    stale.resolve(account);
    await tick();
    expect(accountReads).toBe(3);
    expect(deviceReads).toBe(1);
    expect(store.get().data?.devices[0]?.name).toBe("Account A device");
    current.resolve(nextAccount);
    await tick();
    expect(store.get().data?.account.login?.accountId).toBe("b");
    expect(store.get().data?.devices[0]?.name).toBe("Account B device");
  } finally {
    stale.resolve(account);
    current.resolve(nextAccount);
    unsubscribe();
  }
});

test("incomplete downloads publish without waiting for irrelevant project preparation", async () => {
  let changed = () => {};
  let sync: ProjectSyncStatus = { state: "first-download-incomplete", offlineReady: false };
  let projectReads = 0;
  const project = Promise.withResolvers<{ state: "preparing" }>();
  const store = createCloudStore(
    {
      events: {
        subscribe(event, listener) {
          if ((typeof event === "string" ? event : event.id) === accountEvents.projectSyncChanged.id)
            changed = listener;
          return () => {};
        },
      },
      account: {
        status: async () => account,
        projectSyncStatus: async () => sync,
        devices: async () => [],
      },
    },
    "project",
    false,
    async () => {
      projectReads++;
      return project.promise;
    },
  );
  const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
  const unsubscribe = store.subscribe(() => {});
  try {
    await tick();
    expect(store.get().data?.sync).toEqual({ state: "first-download-incomplete", offlineReady: false });
    expect(projectReads).toBe(0);
    sync = { state: "synced", offlineReady: true };
    changed();
    await tick();
    expect(projectReads).toBe(1);
    project.resolve({ state: "preparing" });
    await tick();
    expect(store.get().data?.sync).toEqual(sync);
    expect(store.get().data?.project).toEqual({ state: "preparing" });
  } finally {
    project.resolve({ state: "preparing" });
    unsubscribe();
  }
});
