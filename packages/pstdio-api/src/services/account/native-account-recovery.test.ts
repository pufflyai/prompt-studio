import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNativeAccount } from "./native-account";

const waitFor = async (condition: () => boolean) => {
  for (let attempt = 0; attempt < 200 && !condition(); attempt++) await Bun.sleep(5);
  expect(condition()).toBe(true);
};

// A device whose account lists one cloud project that exists here and one that does not yet.
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "native-account-recovery-"));
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) =>
      new URL(request.url).pathname === "/v1/account"
        ? Response.json({ features: { relay: true } })
        : Response.json([{ workbenchId: "here" }, { workbenchId: "elsewhere" }]),
  });
  const file = join(root, "native-account.json");
  await Bun.write(
    file,
    JSON.stringify({
      login: {
        managerOrigin: manager.url.origin,
        relayOrigin: manager.url.origin,
        accountId: "account",
        deviceId: "device",
        token: "device-credential",
      },
    }),
  );
  const local = new Set(["here"]);
  const lookup = { fails: false };
  const account = createNativeAccount({
    file,
    environment: { get: async () => ({ environmentId: "device" }) },
    projects: {
      get: async (id: string) => {
        if (lookup.fails && id === "elsewhere") throw new Error("Database busy");
        return local.has(id) ? ({ id } as never) : (null as never);
      },
    },
  });
  let synced: string[] = [];
  const recoveries: { id: string; signal: AbortSignal; done: ReturnType<typeof Promise.withResolvers<void>> }[] = [];
  account.start(
    async (connections) => {
      synced = connections.map((connection) => connection.workbenchId);
    },
    async () => ({ state: "synced", offlineReady: true }),
    async (connection, signal) => {
      const recovery = { id: connection.workbenchId, signal, done: Promise.withResolvers<void>() };
      recoveries.push(recovery);
      await recovery.done.promise;
    },
  );
  return {
    account,
    local,
    lookup,
    recoveries,
    synced: () => synced,
    close: async () => {
      for (const recovery of recoveries) recovery.done.resolve();
      await account.close();
      await manager.stop(true);
      await rm(root, { recursive: true, force: true });
    },
  };
};

test("projects on this device sync while a missing cloud project is still being recovered", async () => {
  const device = await fixture();
  try {
    await device.account.refresh();
    expect(device.synced()).toEqual(["here"]);
    await waitFor(() => device.recoveries.length === 1);
    expect(device.recoveries[0]!.id).toBe("elsewhere");

    // Once recovered, the project syncs too.
    device.local.add("elsewhere");
    device.recoveries[0]!.done.resolve();
    await waitFor(() => device.synced().includes("elsewhere"));
    expect(device.synced()).toEqual(["here", "elsewhere"]);
  } finally {
    await device.close();
  }
});

test("a failed recovery is tried again on the next account refresh", async () => {
  const device = await fixture();
  try {
    await device.account.refresh();
    await waitFor(() => device.recoveries.length === 1);
    device.recoveries[0]!.done.reject(new Error("Relay unreachable"));
    await Bun.sleep(10);

    await device.account.refresh();
    await waitFor(() => device.recoveries.length === 2);
    expect(device.recoveries[1]!.id).toBe("elsewhere");
  } finally {
    await device.close();
  }
});

test("a failed project lookup after a recovery is tried again on the next account refresh", async () => {
  const device = await fixture();
  try {
    await device.account.refresh();
    await waitFor(() => device.recoveries.length === 1);
    device.lookup.fails = true;
    device.recoveries[0]!.done.resolve();
    await Bun.sleep(10);

    device.lookup.fails = false;
    await device.account.refresh();
    await waitFor(() => device.recoveries.length === 2);
  } finally {
    await device.close();
  }
});

test("closing the account stops a recovery in progress", async () => {
  const device = await fixture();
  try {
    await device.account.refresh();
    await waitFor(() => device.recoveries.length === 1);
    const closing = device.account.close();
    expect(device.recoveries[0]!.signal.aborted).toBe(true);
    device.recoveries[0]!.done.resolve();
    await closing;
  } finally {
    await device.close();
  }
});
