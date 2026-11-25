import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import { Hono } from "hono";
import { createNativeAccount } from "../../services/account/native-account";
import type { CloudReturn } from "../../services/account/native-cloud-return";
import { createNativeStore } from "../../services/account/native-store";
import { createProjectCopyStore } from "../../services/account/project-copy-store";
import { createAccountRoutes } from "./routes";

const teamId = "team";

const fixture = async (teamOwned = false) => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-sync-authority-"));
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const { pathname, searchParams } = new URL(request.url);
      if (pathname === "/v1/account") return Response.json({ features: { relay: true } });
      if (pathname === "/v1/teams")
        return Response.json(
          teamOwned ? [{ accountId: teamId, name: "Team", role: "owner", features: { relay: true } }] : [],
        );
      if (pathname === "/v1/workbenches") {
        const teamScope = searchParams.get("accountId") === teamId;
        return Response.json(teamScope === teamOwned ? [{ workbenchId: "project" }] : []);
      }
      return Response.json({ ok: true });
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
  if (teamOwned)
    await createProjectCopyStore(join(root, "account.json")).bindTeamProject(
      { accountId: teamId, managerOrigin: login.managerOrigin, projectId: "project" },
      async () => true,
    );
  const state = { syncReads: 0, awayReads: 0, hold: undefined as "sync" | "away" | undefined };
  const entered = Promise.withResolvers<void>(),
    release = Promise.withResolvers<void>();
  const account = createNativeAccount({
    file: join(root, "account.json"),
    environment: { get: async () => ({ environmentId: "device" }) },
    projects: { get: async (id: string) => ({ id, name: "Team notes" }) as never },
  });
  const cloud = {
    signOut: async () => {},
    release: async () => {},
    removalState: async () => "pending",
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

test("the SDK project-sync route validates local and account expectations before native admission", async () => {
  const f = await fixture();
  const app = new Hono().route("/v1", createAccountRoutes(f.account));
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch });
  const client = createClient({ baseUrl: server.url.origin, token: "" });
  try {
    const invalid = await app.request(
      "/v1/account/projects/project/sync?local=true&accountId=account&managerOrigin=" +
        encodeURIComponent(f.login.managerOrigin),
    );
    expect(invalid.status).toBe(400);
    expect(f.state.syncReads).toBe(0);
    await expect(client.account.projectSyncStatus("project", { expected: null })).rejects.toThrow();
    expect(f.state.syncReads).toBe(0);
    expect(
      await client.account.projectSyncStatus("project", {
        expected: { accountId: f.login.accountId, managerOrigin: f.login.managerOrigin },
      }),
    ).toMatchObject({ state: "synced" });
    await f.store.forget(f.login.token);
    expect(await client.account.projectSyncStatus("project", { expected: null })).toMatchObject({ state: "local" });
  } finally {
    await server.stop(true);
    await f.close();
  }
});

test("reads a team project's sync status with the native device's personal login", async () => {
  const f = await fixture(true);
  const app = new Hono().route("/v1", createAccountRoutes(f.account));
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch });
  const client = createClient({ baseUrl: server.url.origin, token: "" });
  try {
    const { login, teamProjects } = await client.account.status();
    expect(teamProjects).toEqual({ project: teamId });
    expect(login).toMatchObject({
      accountId: f.login.accountId,
      managerOrigin: f.login.managerOrigin,
      relayOrigin: f.login.relayOrigin,
      deviceId: f.login.deviceId,
    });
    const catalog = await client.account.projectsCatalog({ accountId: teamId });
    expect(catalog.account).toEqual({ accountId: teamId, managerOrigin: f.login.managerOrigin });

    const unprojected = new URLSearchParams({ ...login! });
    const route = "/v1/account/projects/project/sync";
    expect((await app.request(`${route}?${unprojected}`)).status).toBe(400);
    const reads = f.state.syncReads;
    await expect(client.account.projectSyncStatus("project", { expected: catalog.account })).rejects.toThrow();
    expect(f.state.syncReads).toBe(reads);
    expect(await client.account.projectSyncStatus("project", { expected: login })).toMatchObject({
      state: "synced",
      offlineReady: true,
    });
  } finally {
    await server.stop(true);
    await f.close();
  }
});

test("a queued removal cannot apply one team member's discard consent as another member", async () => {
  const f = await fixture(true);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const expectedAccount = { accountId: teamId, managerOrigin: f.login.managerOrigin };
  const queuedAtNative = Promise.withResolvers<void>();
  const cleaned: string[] = [];
  let freezes = 0;
  f.account.connectProjectCopies({
    inspect: async () => ({ removesManagedFolder: false, providerWorkspaceCount: 0 }),
    prepareFolder: async () => {},
    freeze: () => {
      freezes++;
    },
    suspend: () => {},
    release: () => {},
    async drain() {
      entered.resolve();
      await release.promise;
    },
    async cleanup({ userId }) {
      cleaned.push(userId!);
    },
  });
  let removals = 0;
  const app = new Hono().route(
    "/v1",
    createAccountRoutes({
      ...f.account,
      removeLocalProject(...args) {
        const result = f.account.removeLocalProject(...args);
        if (++removals === 2) queuedAtNative.resolve();
        return result;
      },
    }),
  );
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch });
  const client = createClient({ baseUrl: server.url.origin, token: "" });
  try {
    const { login: expectedDevice } = await client.account.status();
    expect(expectedDevice).not.toBeNull();
    expect(await client.account.projectLocalRemoval("project", { expectedDevice: expectedDevice! })).toMatchObject({
      account: expectedAccount,
      requiresDiscard: true,
    });
    const remove = (device = expectedDevice!) =>
      client.account.removeLocalProject("project", { discardUnsynced: true, expectedAccount, expectedDevice: device });
    const first = remove().catch((error: unknown) => error);
    await Promise.race([entered.promise, first]);
    const queued = remove().catch((error: unknown) => error);
    await Promise.race([queuedAtNative.promise, queued]);
    const other = { ...f.login, accountId: "other-account", token: "other-credential" };
    await f.store.save(other);
    await f.account.refresh();
    expect((await f.account.status()).teamProjects).toEqual({ project: teamId });
    release.resolve();
    expect(await first).toBeInstanceOf(Error);
    expect(await queued).toMatchObject({ message: expect.stringContaining("active Cloud device changed") });
    expect(freezes).toBe(1);
    expect(cleaned).toEqual([]);
    const { login } = await client.account.status();
    expect(await remove(login!)).toEqual({ projectId: "project", presence: "cloud-only" });
    expect(cleaned).toEqual([other.accountId]);
  } finally {
    release.resolve();
    await server.stop(true);
    await f.close();
  }
});

test("strict Cloud copy routes bind the device separately from the team", async () => {
  const f = await fixture(true);
  const app = new Hono().route("/v1", createAccountRoutes(f.account));
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch });
  const client = createClient({ baseUrl: server.url.origin, token: "" });
  const team = { accountId: teamId, managerOrigin: f.login.managerOrigin };
  try {
    const { login: first } = await client.account.status();
    expect(first).not.toBeNull();
    expect((await app.request("/v1/account/projects?accountId=team&deviceId=device")).status).toBe(400);
    const other = { ...f.login, accountId: "other-account", token: "other-credential" };
    await f.store.save(other);
    await f.account.refresh();
    const { login: second, teamProjects } = await client.account.status();
    expect(second).not.toBeNull();
    expect(teamProjects).toEqual({ project: teamId });
    expect(await client.account.projectsCatalog({ accountId: teamId, expectedDevice: second! })).toMatchObject({
      account: team,
      projects: [{ id: "project" }],
    });
    await expect(client.account.projectsCatalog({ accountId: teamId, expectedDevice: first! })).rejects.toThrow(
      "active Cloud device changed",
    );
    await expect(
      client.account.projectsCatalog({ accountId: teamId, expectedDevice: { ...second!, deviceId: "other-device" } }),
    ).rejects.toThrow("active Cloud device changed");
    await expect(
      client.account.downloadCloudProject("project", { expected: team, expectedDevice: first! }),
    ).rejects.toThrow("active Cloud device changed");
    await expect(
      client.account.downloadCloudProject("project", { expected: team, expectedDevice: second! }),
    ).resolves.toMatchObject({ presence: "downloaded" });
    await expect(client.account.projectLocalRemoval("project", { expectedDevice: first! })).rejects.toThrow(
      "active Cloud device changed",
    );
    await expect(
      client.account.projectDeletionStatus("project", { expected: team, expectedDevice: first! }),
    ).rejects.toThrow("active Cloud device changed");
    await expect(
      client.account.deleteCloudProject("project", { confirm: true, expectedAccount: team, expectedDevice: first! }),
    ).rejects.toThrow("active Cloud device changed");
  } finally {
    await server.stop(true);
    await f.close();
  }
});
