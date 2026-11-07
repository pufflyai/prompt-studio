import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNativeAccount } from "./native-account";
import type { CloudReturn } from "./native-cloud-return";

const status = {
  state: "signed-out" as const,
  changed: {
    total: 1,
    deletions: 0,
    records: [{ extensionId: "tickets", recordId: "PS-1", fields: ["/title"], deleted: false, created: false }],
  },
  replaced: { total: 0, records: [] },
};

const fakeCloud = () => {
  const calls: unknown[][] = [];
  const cloud = {
    signOut: async () => {
      calls.push(["signOut"]);
    },
    release: async (ids: string[], accountId?: string) => {
      calls.push(["release", ids, accountId]);
    },
    status: async () => status,
    apply: async (id: string) => {
      calls.push(["apply", id]);
      return true;
    },
    discard: async () => false,
    dismissReplaced: async (id: string) => {
      calls.push(["dismiss", id]);
    },
  } satisfies CloudReturn;
  return { cloud, calls };
};

const account = async (manager?: URL) => {
  const root = await mkdtemp(join(tmpdir(), "native-cloud-return-"));
  const file = join(root, "native-account.json");
  const login = {
    managerOrigin: manager?.origin ?? "https://127.0.0.1:1",
    relayOrigin: "https://127.0.0.1:1",
    accountId: "account",
    deviceId: "device",
    token: "device-credential",
  };
  await Bun.write(file, JSON.stringify({ login }));
  const { cloud, calls } = fakeCloud();
  const service = createNativeAccount({
    file,
    environment: { get: async () => ({ environmentId: "device" }) },
    projects: { get: async (id: string) => ({ id }) as never },
  });
  service.start(
    async () => {},
    async () => ({ state: "synced", offlineReady: true }),
    async () => {},
    undefined,
    undefined,
    undefined,
    cloud,
  );
  return {
    service,
    calls,
    close: async () => {
      await service.close();
      await rm(root, { recursive: true, force: true });
    },
  };
};

test("signing out ends sync on this device even when the account service is unreachable", async () => {
  const host = await account();
  try {
    await host.service.refresh();
    // Signed in but offline: the project list is unknown, so nothing is released or folded.
    expect(host.calls).toEqual([]);
    await host.service.logout();
    expect(host.calls).toContainEqual(["signOut"]);
    const sync = await host.service.projectSyncStatus("project");
    expect(sync).toMatchObject({ state: "local", away: { state: "signed-out", total: 1 } });
    expect(sync.replaced).toBeUndefined();
  } finally {
    await host.close();
  }
});

test("once the account's projects load, projects it does not sync are released", async () => {
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      if (new URL(request.url).pathname === "/v1/account") return Response.json({ features: { relay: true } });
      return Response.json([{ workbenchId: "kept" }]);
    },
  });
  const host = await account(manager.url);
  try {
    await host.service.refresh();
    // The account decides whether an unlisted project stopped syncing or belongs to another account.
    expect(host.calls).toContainEqual(["release", ["kept"], "account"]);
    await host.service.resolveReturnedChanges("kept", "apply");
    await host.service.resolveReturnedChanges("kept", "dismiss");
    expect(host.calls).toEqual(
      expect.arrayContaining([
        ["apply", "kept"],
        ["dismiss", "kept"],
      ]),
    );
    await expect(host.service.resolveReturnedChanges("kept", "discard")).rejects.toThrow("No changes are held");
  } finally {
    await host.close();
    await manager.stop(true);
  }
});
