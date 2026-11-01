import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNativeAccount } from "./native-account";
import { createNativeStore } from "./native-store";

test("a rejected device requires sign-in across restarts until a new login is saved", async () => {
  const root = await mkdtemp(join(tmpdir(), "sign-in-required-"));
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => Response.json({ error: "rejected" }, { status: 401 }),
  });
  const file = join(root, "native-account.json");
  const login = {
    managerOrigin: manager.url.origin,
    relayOrigin: manager.url.origin,
    accountId: "account",
    deviceId: "device",
    token: "rejected-credential",
  };
  const create = () =>
    createNativeAccount({
      file,
      environment: { get: async () => ({ environmentId: "device" }) },
      projects: {
        get: async () => {
          throw new Error("Account status must not read project content");
        },
      },
    });
  let account = create();
  try {
    const store = createNativeStore(file);
    await store.save(login);
    await account.refresh();
    expect(await account.status()).toMatchObject({ login: null, signInRequired: true });
    await account.close();
    account = create();
    expect(await account.status()).toMatchObject({ login: null, signInRequired: true });
    await account.logout();
    expect(await account.status()).not.toMatchObject({ signInRequired: true });
    await store.save({ ...login, token: "new-credential" });
    expect(await account.status()).not.toMatchObject({ signInRequired: true });
  } finally {
    await account.close();
    await manager.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});

for (const mode of ["offline", "no-early-access", "project-removed"] as const) {
  test(`${mode} does not request a new sign-in`, async () => {
    const root = await mkdtemp(join(tmpdir(), "account-status-"));
    const manager = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        if (mode === "offline") return new Response(null, { status: 503 });
        const path = new URL(request.url).pathname;
        if (path === "/v1/account") return Response.json({ features: { relay: mode !== "no-early-access" } });
        if (path === "/v1/devices/presence") return Response.json({ ok: true });
        return Response.json([]);
      },
    });
    const file = join(root, "native-account.json");
    const store = createNativeStore(file);
    await store.save({
      managerOrigin: manager.url.origin,
      relayOrigin: manager.url.origin,
      accountId: "account",
      deviceId: "device",
      token: "credential",
    });
    const account = createNativeAccount({
      file,
      environment: { get: async () => ({ environmentId: "device" }) },
      projects: {
        get: async () => {
          throw new Error("No project should be opened");
        },
      },
    });
    try {
      await account.refresh();
      expect(await account.status()).toMatchObject({ login: { deviceId: "device" } });
      expect(await account.status()).not.toMatchObject({ signInRequired: true });
    } finally {
      await account.close();
      await manager.stop(true);
      await rm(root, { recursive: true, force: true });
    }
  });
}

test("explicit sign-out clears rejection that arrives while device removal is in flight", async () => {
  const root = await mkdtemp(join(tmpdir(), "logout-rejection-"));
  const requested = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch() {
      requested.resolve();
      await release.promise;
      return Response.json({ ok: true });
    },
  });
  const file = join(root, "native-account.json");
  const store = createNativeStore(file);
  await store.save({
    managerOrigin: manager.url.origin,
    relayOrigin: manager.url.origin,
    accountId: "account",
    deviceId: "device",
    token: "credential",
  });
  const account = createNativeAccount({
    file,
    environment: { get: async () => ({ environmentId: "device" }) },
    projects: {
      get: async () => {
        throw new Error("No project should be opened");
      },
    },
  });
  try {
    const signingOut = account.logout();
    await requested.promise;
    await store.reject("credential");
    release.resolve();
    await signingOut;
    expect(await account.status()).not.toMatchObject({ signInRequired: true });
  } finally {
    release.resolve();
    await account.close();
    await manager.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});
