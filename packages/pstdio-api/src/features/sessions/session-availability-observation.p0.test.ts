import { expect, test } from "bun:test";
import { observeSessionAvailability, readObservedSessionDevices } from "./session-availability-observation";

const fixture = () => {
  type Account = Parameters<typeof observeSessionAvailability>[0];
  const state = {
    login: {
      accountId: "account",
      deviceId: "here",
      managerOrigin: "https://manager.test",
      relayOrigin: "https://relay.test",
    } as Awaited<ReturnType<Account["status"]>>["login"],
    online: false,
    reads: 0,
    read: async () => {},
  };
  const listeners = new Set<() => void>();
  const account: Account = {
    status: async () => ({ login: state.login, features: null, cloudProjects: [], cloudProjectsLoaded: true }),
    devices: async () => {
      state.reads++;
      await state.read();
      return [
        {
          id: "peer",
          name: "Peer",
          online: state.online,
          current: false,
          platform: "test",
          createdAt: "",
          lastSeenAt: "",
        },
      ];
    },
    watch: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return {
    account,
    state,
    listeners,
    changed: () => {
      for (const listener of [...listeners]) listener();
    },
  };
};

test("observed remote sessions share one presence probe and release its final timer", async () => {
  const f = fixture();
  const changed = Promise.withResolvers<void>();
  const first = observeSessionAvailability(f.account, () => changed.resolve());
  await first.ready;
  const second = observeSessionAvailability(f.account, () => {});
  await second.ready;
  try {
    expect(f.state.reads).toBe(1);
    f.state.online = true;
    await changed.promise;
    expect(f.state.reads).toBe(2);
    const status = await f.account.status();
    expect(await readObservedSessionDevices(f.account, status)).toMatchObject([{ id: "peer", online: true }]);
    expect(f.state.reads).toBe(2);
    first.close();
    expect(f.listeners.size).toBe(1);
    second.close();
    expect(f.listeners.size).toBe(0);
    await Bun.sleep(2100);
    expect(f.state.reads).toBe(2);
  } finally {
    first.close();
    second.close();
  }
});

test("a late presence reply cannot restore a signed-out authority", async () => {
  const f = fixture();
  const held = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const watch = observeSessionAvailability(f.account, () => {});
  await watch.ready;
  try {
    const previous = await f.account.status();
    f.state.read = async () => {
      held.resolve();
      await release.promise;
    };
    f.changed();
    await held.promise;
    const oldRead = readObservedSessionDevices(f.account, previous);
    f.state.login = null;
    f.changed();
    release.resolve();
    expect(await oldRead).toEqual([]);
    expect(await readObservedSessionDevices(f.account, await f.account.status())).toEqual([]);
    expect(f.state.reads).toBe(2);
  } finally {
    release.resolve();
    watch.close();
  }
});
