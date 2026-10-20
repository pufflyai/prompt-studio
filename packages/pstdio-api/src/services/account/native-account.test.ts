import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNativeAccount } from "./native-account";
import { createAccountHostFixture } from "./native-host.fixture";

const login = (deviceId: string) => ({
  // Nothing listens on port 1, so the account service is unreachable.
  managerOrigin: "https://127.0.0.1:1",
  relayOrigin: "https://127.0.0.1:1",
  accountId: "account",
  deviceId,
  token: "device-credential",
});

test("membership discovery finishing after shutdown cannot restart device presence", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-account-close-"));
  const requested = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let heartbeats = 0;
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      if (new URL(request.url).pathname === "/v1/devices/presence") {
        heartbeats++;
        return Response.json({ ok: true });
      }
      requested.resolve();
      await release.promise;
      return Response.json([]);
    },
  });
  const file = join(root, "native-account.json");
  await Bun.write(file, JSON.stringify({ login: { ...login("device"), managerOrigin: manager.url.origin } }));
  const account = createNativeAccount({
    file,
    environment: { get: async () => ({ environmentId: "device" }) },
    projects: {
      get: async () => {
        throw new Error("No Cloud projects should be loaded");
      },
    },
  });
  try {
    const refreshing = account.refresh();
    await requested.promise;
    account.close();
    release.resolve();
    await refreshing;
    await Bun.sleep(20);
    expect(heartbeats).toBe(0);
  } finally {
    release.resolve();
    account.close();
    await manager.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});

test("logout clears the login even when the account service is unreachable", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-account-offline-"));
  const host = await createAccountHostFixture(root);
  try {
    const { environmentId } = await host.deps.environmentService.get();
    await Bun.write(host.file, JSON.stringify({ login: login(environmentId) }));
    expect((await host.account.status()).login?.deviceId).toBe(environmentId);
    expect(await host.account.logout()).toEqual({ ok: true, removed: false });
    expect(await host.account.status()).toEqual({
      login: null,
      cloudProjects: [],
      cloudProjectsLoaded: true,
      signInAvailable: false,
    });
    expect(JSON.parse(await readFile(host.file, "utf8"))).toEqual({ login: null });
  } finally {
    await host.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("a login saved for another device counts as logged out and syncs nothing", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-account-other-device-"));
  const host = await createAccountHostFixture(root);
  try {
    await Bun.write(host.file, JSON.stringify({ login: login("another-database") }));
    await host.account.refresh();
    expect(await host.account.status()).toEqual({
      login: null,
      cloudProjects: [],
      cloudProjectsLoaded: true,
      signInAvailable: false,
    });
    expect(host.synced()).toEqual([]);
  } finally {
    await host.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("an offline account lookup never labels an unknown Cloud project local-only", async () => {
  const root = await mkdtemp(join(tmpdir(), "native-account-readiness-"));
  const host = await createAccountHostFixture(root);
  try {
    const project = await host.projects.create({ name: "Offline project" });
    const { environmentId } = await host.deps.environmentService.get();
    await Bun.write(host.file, JSON.stringify({ login: login(environmentId) }));
    await host.account.refresh();
    const status = await host.app.request(`/v1/account/projects/${project.id}/sync`);
    expect(status.status).toBe(200);
    expect(await status.json()).toEqual({ state: "offline", offlineReady: false });
    expect((await host.account.status()).cloudProjectsLoaded).toBe(false);
  } finally {
    await host.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("an existing project starts syncing after another device enables Cloud", async () => {
  const { spyOn } = await import("bun:test");
  const realTimeout = setTimeout;
  let nextRefresh: (() => void) | undefined;
  const clock = spyOn(globalThis, "setTimeout").mockImplementation(((...args: Parameters<typeof setTimeout>) => {
    if (args[1] === 60_000 && typeof args[0] === "function") nextRefresh = args[0];
    return realTimeout(...args);
  }) as typeof setTimeout);
  const root = await mkdtemp(join(tmpdir(), "native-account-remote-cloud-"));
  let ids: string[] = [];
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => Response.json(ids.map((workbenchId) => ({ workbenchId }))),
  });
  const project = {
    id: "project",
    name: "Shared later",
    shorthand: "PR-1",
    default_agent_id: null,
    default_agent_model: null,
    startup_script: null,
    created_at: "2026-10-20",
    updated_at: "2026-10-20",
    deleted_at: null,
  };
  const file = join(root, "native-account.json");
  await Bun.write(file, JSON.stringify({ login: { ...login("device"), managerOrigin: manager.url.origin } }));
  const account = createNativeAccount({
    file,
    environment: { get: async () => ({ environmentId: "device" }) },
    projects: { get: async () => project },
  });
  let synced: string[] = [];
  const discovered = Promise.withResolvers<void>();
  account.start(async (connections) => {
    synced = connections.map((entry) => entry.workbenchId);
    if (synced.length) discovered.resolve();
  });
  try {
    await account.refresh();
    expect(synced).toEqual([]);
    ids = [project.id];
    expect(nextRefresh).toBeDefined();
    nextRefresh!();
    const refreshed = await Promise.race([
      discovered.promise.then(() => true),
      new Promise<boolean>((resolve) => realTimeout(() => resolve(false), 1_000)),
    ]);
    expect(refreshed).toBe(true);
    expect(synced).toEqual([project.id]);
  } finally {
    account.close();
    clock.mockRestore();
    await manager.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});
