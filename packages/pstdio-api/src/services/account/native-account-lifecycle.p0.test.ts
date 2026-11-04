import { expect, spyOn, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AccountRequestError, createNativeAccount } from "./native-account";

const projects = {
  get: async () => {
    throw new Error("Unexpected project read without a loaded Cloud project list");
  },
};

test("account close drains a startup identity read before its database owner can close", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-account-close-"));
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const account = createNativeAccount({
    file: join(root, "account.json"),
    environment: {
      get: async () => {
        entered.resolve();
        await release.promise;
        return { environmentId: "device" };
      },
    },
    projects,
  });
  account.start(
    async () => {},
    async () => ({ state: "local", offlineReady: true }),
    async () => {},
  );
  await entered.promise;
  let closed = false;
  const closing = account.close().then(() => {
    closed = true;
  });
  try {
    await Bun.sleep(0);
    expect(closed).toBe(false);
  } finally {
    release.resolve();
    await closing;
    await rm(root, { recursive: true, force: true });
  }
});

test("starting without a device sender retains the unavailable action instead of connecting it to itself", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-account-sender-"));
  const account = createNativeAccount({
    file: join(root, "account.json"),
    environment: { get: async () => ({ environmentId: "device" }) },
    projects,
  });
  try {
    account.start(
      async () => {},
      async () => ({ state: "local", offlineReady: true }),
      async () => {},
    );
    await account.refresh();
    await expect(
      account.sendDeviceCommand(
        "project",
        "device",
        { type: "session.interrupt", id: "session" },
        new AbortController().signal,
      ),
    ).rejects.toThrow("not connected to Cloud");
  } finally {
    await account.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("account close aborts a blocked manager lookup before waiting for refresh to drain", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-account-fetch-close-"));
  const file = join(root, "account.json");
  await Bun.write(
    file,
    JSON.stringify({
      login: {
        managerOrigin: "http://127.0.0.1:1",
        relayOrigin: "http://127.0.0.1:1",
        accountId: "account",
        deviceId: "device",
        token: "fixture-credential",
      },
    }),
  );
  const entered = Promise.withResolvers<void>();
  const signals: AbortSignal[] = [];
  const release: ((reason: Error) => void)[] = [];
  const blockedFetch = Object.assign(
    (...[_request, options]: Parameters<typeof fetch>) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = options!.signal!;
        signals.push(signal);
        release.push(reject);
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        entered.resolve();
      }),
    { preconnect: fetch.preconnect },
  );
  const requests = spyOn(globalThis, "fetch").mockImplementation(blockedFetch);
  const account = createNativeAccount({
    file,
    environment: { get: async () => ({ environmentId: "device" }) },
    projects,
  });
  account.start(
    async () => {},
    async () => ({ state: "local", offlineReady: true }),
    async () => {},
  );
  await entered.promise;
  const closing = account.close();
  try {
    await Bun.sleep(0);
    expect(signals.length).toBeGreaterThan(0);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    await closing;
    expect((await Bun.file(file).json()).login.token).toBe("fixture-credential");
  } finally {
    for (const reject of release) reject(new Error("Release diagnostic lookup"));
    await closing;
    requests.mockRestore();
    await rm(root, { recursive: true, force: true });
  }
});

test("revoked key lookup returns before refresh waits for its command owner to drain", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-account-revoked-command-"));
  const file = join(root, "account.json");
  await Bun.write(
    file,
    JSON.stringify({
      login: {
        managerOrigin: "http://127.0.0.1:1",
        relayOrigin: "http://127.0.0.1:1",
        accountId: "account",
        deviceId: "device",
        token: "fixture-credential",
      },
    }),
  );
  const managerFetch = Object.assign(
    async (...[request]: Parameters<typeof fetch>) => {
      const path = new URL(String(request)).pathname;
      if (path.endsWith("/signing-key")) return Response.json({ error: "Device removed" }, { status: 401 });
      return Response.json(path === "/v1/account" ? { features: { relay: true } } : []);
    },
    { preconnect: fetch.preconnect },
  );
  const requests = spyOn(globalThis, "fetch").mockImplementation(managerFetch);
  const draining = Promise.withResolvers<void>();
  const drained = Promise.withResolvers<void>();
  let removing = false;
  const account = createNativeAccount({
    file,
    environment: { get: async () => ({ environmentId: "device" }) },
    projects,
  });
  account.start(
    async () => {
      if (removing) {
        draining.resolve();
        await drained.promise;
      }
    },
    async () => ({ state: "local", offlineReady: true }),
    async () => {},
  );
  await account.refresh();
  removing = true;
  let settled = false;
  const lookup = account.deviceSigningKey("other-device").catch((error: unknown) => {
    settled = true;
    return error;
  });
  try {
    await draining.promise;
    await Bun.sleep(0);
    expect(settled).toBe(true);
  } finally {
    drained.resolve();
    expect(await lookup).toBeInstanceOf(AccountRequestError);
    expect((await Bun.file(file).json()).login).toBeNull();
    await account.close();
    requests.mockRestore();
    await rm(root, { recursive: true, force: true });
  }
});
