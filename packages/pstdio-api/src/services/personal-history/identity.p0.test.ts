import { expect, test } from "bun:test";
import { EventBus } from "../../features/sync/event-bus";
import { createPersonalIdentity } from "./identity";

test("a stale account read cannot overwrite or return an identity after its change notification", async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let accountId = "alice";
  let first = true;
  let changed = () => {};
  const identity = createPersonalIdentity({
    account: {
      watch: (listener) => {
        changed = listener;
        return () => {};
      },
      status: async () => {
        const startedAccount = accountId;
        if (first) {
          first = false;
          entered.resolve();
          await release.promise;
        }
        return {
          login: {
            accountId: startedAccount,
            deviceId: "device",
            managerOrigin: "http://manager.example",
            relayOrigin: "http://relay.example",
          },
          cloudProjects: [],
          cloudProjectsLoaded: true,
          features: { relay: true },
        };
      },
    },
    eventBus: new EventBus(),
    changed: () => {},
  });
  const pending = identity.read();
  await entered.promise;
  accountId = "bob";
  changed();
  expect((await identity.read())?.accountId).toBe("bob");
  release.resolve();
  expect((await pending)?.accountId).toBe("bob");
  expect(identity.version).toContain("bob");
});

test("a transient identity read failure does not poison later reads without an account change", async () => {
  let calls = 0;
  const identity = createPersonalIdentity({
    account: {
      watch: () => () => {},
      status: async () => {
        if (++calls === 1) throw new Error("Transient login read");
        return { login: null, cloudProjects: [], cloudProjectsLoaded: true, features: null };
      },
    },
    eventBus: new EventBus(),
    changed: () => {},
  });
  await expect(identity.read()).rejects.toThrow("Transient login read");
  expect(await identity.read()).toBeNull();
  expect(calls).toBe(2);
});
