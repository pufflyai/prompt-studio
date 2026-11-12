import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNativeAccount } from "../../services/account/native-account";
import type { CloudReturn } from "../../services/account/native-cloud-return";
import { createNativeStore } from "../../services/account/native-store";

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-sync-authority-"));
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      return Response.json(
        new URL(request.url).pathname === "/v1/account" ? { features: { relay: true } } : [{ workbenchId: "project" }],
      );
    },
  });
  const store = createNativeStore(join(root, "account.json"));
  const login = {
    accountId: "account",
    deviceId: "device",
    token: "colliding-token",
    managerOrigin: manager.url.origin,
    relayOrigin: manager.url.origin,
  };
  await store.save(login);
  const state = { syncReads: 0, awayReads: 0, hold: undefined as "sync" | "away" | undefined };
  const entered = Promise.withResolvers<void>(),
    release = Promise.withResolvers<void>();
  const account = createNativeAccount({
    file: join(root, "account.json"),
    environment: { get: async () => ({ environmentId: "device" }) },
    projects: { get: async (id: string) => ({ id }) as never },
  });
  const cloud = {
    signOut: async () => {},
    release: async () => {},
    apply: async () => false,
    discard: async () => false,
    dismissReplaced: async () => {},
    status: async () => {
      state.awayReads++;
      if (state.hold === "away") {
        entered.resolve();
        await release.promise;
      }
      return {
        state: "signed-out",
        changed: { total: 1, deletions: 0, records: [] },
        replaced: { total: 0, records: [] },
      };
    },
  } satisfies CloudReturn;
  account.start(
    async () => {},
    async () => {
      state.syncReads++;
      if (state.hold === "sync") {
        entered.resolve();
        await release.promise;
      }
      return { state: "synced", offlineReady: true };
    },
    async () => {},
    undefined,
    undefined,
    undefined,
    cloud,
  );
  await account.refresh();
  return {
    account,
    store,
    login,
    state,
    entered,
    release,
    async close() {
      release.resolve();
      await account.close();
      await manager.stop(true);
      await rm(root, { recursive: true, force: true });
    },
  };
};

test.each(["sync", "away"] as const)("project sync fences identity changes during a held %s read", async (hold) => {
  const f = await fixture();
  f.state.hold = hold;
  const expected = { accountId: f.login.accountId, managerOrigin: f.login.managerOrigin };
  const reading = f.account.projectSyncStatus("project", undefined, expected).then(
    (value) => ({ ok: true, value }),
    () => ({ ok: false }),
  );
  try {
    await f.entered.promise;
    // A different manager may issue the same account, device and token strings.
    await f.store.save({ ...f.login, managerOrigin: "https://another-manager.example" });
    f.release.resolve();
    expect(await reading).toEqual({ ok: false });
  } finally {
    f.release.resolve();
    await reading;
    await f.close();
  }
});

test("project sync distinguishes expected local identity from omitted authority", async () => {
  const f = await fixture();
  try {
    await expect(f.account.projectSyncStatus("project", undefined, null)).rejects.toThrow();
    await expect(
      f.account.projectSyncStatus("project", undefined, { accountId: "other", managerOrigin: f.login.managerOrigin }),
    ).rejects.toThrow();
    expect(f.state.syncReads).toBe(0);
    expect(f.state.awayReads).toBe(0);
    expect(await f.account.projectSyncStatus("project")).toMatchObject({ state: "synced", offlineReady: true });
    await f.store.forget(f.login.token);
    expect(await f.account.projectSyncStatus("project", undefined, null)).toMatchObject({
      state: "local",
      offlineReady: false,
    });
    await expect(
      f.account.projectSyncStatus("project", undefined, {
        accountId: f.login.accountId,
        managerOrigin: f.login.managerOrigin,
      }),
    ).rejects.toThrow();
  } finally {
    await f.close();
  }
});
