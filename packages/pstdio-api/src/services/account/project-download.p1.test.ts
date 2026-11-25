import { expect, test } from "bun:test";
import { lstat, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { expectRejection } from "../../test-utils/expect-rejection";
import { nativeAccountFile } from "./native-account";
import { createAccountHostFixture } from "./native-host.fixture";
import { createNativeStore } from "./native-store";
import { createProjectCopyStore } from "./project-copy-store";

test("a Cloud only project can be listed and deleted without starting a download", async () => {
  const root = await mkdtemp(join(tmpdir(), "cloud-project-catalog-"));
  const databasePath = join(root, "db");
  const storageRoot = join(root, "storage");
  const file = nativeAccountFile(databasePath, storageRoot);
  const id = crypto.randomUUID();
  const name = "Removed on this device";
  const operation = {
    workbenchId: id,
    operationId: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    state: "deleting",
    completedAt: null,
  };
  const managerPath = `/v1/workbenches/${id}/deletion`;
  let deletionStarted = false;
  let loseReply = true;
  let deletionAvailable = true;
  let downloads = 0;
  const handleDeletion = async (request: Request) => {
    if (request.method === "POST") {
      expect(await request.json()).toEqual({ confirm: true });
      deletionStarted = true;
      if (loseReply) {
        loseReply = false;
        return Response.json({ error: "Connection interrupted after acceptance" }, { status: 503 });
      }
    }
    return deletionStarted ? Response.json(operation) : new Response(null, { status: 404 });
  };
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const { pathname } = new URL(request.url);
      if (pathname === "/v1/account") {
        return Response.json({ features: { relay: true }, projectDeletion: deletionAvailable });
      }
      if (pathname === "/v1/workbenches") return Response.json(deletionStarted ? [] : [{ workbenchId: id }]);
      if (pathname === "/v1/project-deletions") return Response.json(deletionStarted ? [operation] : []);
      if (pathname === "/v1/devices/presence") return Response.json({ ok: true });
      if (pathname === managerPath) return handleDeletion(request);
      if (pathname === "/v1/environment-access") downloads++;
      return Response.json({ error: "not found" }, { status: 404 });
    },
  });
  const host = await createTestApp({ databasePath, storageRoot });
  try {
    const { environmentId } = await host.deps.environmentService.get();
    const account = { managerOrigin: manager.url.origin, accountId: "fixture-account", deviceId: environmentId };
    await createProjectCopyStore(file).write({ ...account, projectId: id, name, phase: "cloud-only" });
    const store = createNativeStore(file);
    const login = { ...account, relayOrigin: manager.url.origin, token: "fixture-device" };
    await store.save(login);
    await host.deps.accountService.refresh();
    const catalog = async () => (await host.app.request("/v1/account/projects")).json();

    expect(await catalog()).toMatchObject({
      projects: [{ id, name, presence: "cloud-only", actions: { download: true, deleteCloud: true } }],
    });
    const path = `/v1/account/projects/${id}`;
    const start = (body: unknown) =>
      host.app.request(`${path}/delete-cloud`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    expect((await start({})).status).toBe(400);
    expect((await host.app.request(`${path}/deletion?accountId=fixture-account`)).status).toBe(400);
    expect(
      (await host.app.request(`${path}/deletion?managerOrigin=${encodeURIComponent(manager.url.origin)}`)).status,
    ).toBe(400);
    const { account: expectedAccount } = await catalog();
    await store.save({ ...login, accountId: "other-account", token: "other-device-login" });
    expect((await start({ confirm: true, expectedAccount })).status).toBe(400);
    expect(deletionStarted).toBe(false);
    await store.save(login);
    await host.deps.accountService.refresh();
    const lost = await start({ confirm: true, expectedAccount });
    expect(lost.status).toBe(400);
    expect(deletionStarted).toBe(true);
    const statusPath = `${path}/deletion`;
    const receipt = await (await host.app.request(statusPath)).json();
    const resumed = await start({ confirm: true });
    expect(resumed.status).toBe(202);
    expect(await resumed.json()).toEqual(receipt);
    expect(receipt).toMatchObject({ projectId: id, state: "deleting" });
    deletionAvailable = false;
    await host.deps.accountService.refresh();
    expect(await catalog()).toMatchObject({ projects: [], deletions: [{ ...receipt, name }] });
    const status = await host.app.request(`${path}/deletion`);
    expect(await status.json()).toEqual(receipt);
    expect(await host.deps.projectService.get(id)).toBeNull();
    expect(downloads).toBe(0);
  } finally {
    await host.close();
    await manager.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});

test("known Cloud membership stays visible before its project metadata can be recovered", async () => {
  const root = await mkdtemp(join(tmpdir(), "cloud-project-metadata-pending-"));
  const host = await createAccountHostFixture(root);
  const id = crypto.randomUUID();
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/v1/account") return Response.json({ features: { relay: true }, projectDeletion: true });
      if (path === "/v1/workbenches") return Response.json([{ workbenchId: id }]);
      if (path === "/v1/project-deletions") return Response.json([]);
      return Response.json({ error: "metadata unavailable" }, { status: 503 });
    },
  });
  try {
    const { environmentId } = await host.deps.environmentService.get();
    await createNativeStore(host.file).save({
      managerOrigin: manager.url.origin,
      relayOrigin: manager.url.origin,
      accountId: "fixture-account",
      deviceId: environmentId,
      token: "fixture-device",
    });
    await host.account.refresh();
    expect(await host.projects.get(id)).toBeNull();
    const catalog = async () => (await host.app.request("/v1/account/projects")).json();
    expect(await catalog()).toMatchObject({
      projects: [
        {
          id,
          name: id,
          presence: "downloading",
          actions: { download: true, deleteCloud: true, removeLocal: false },
        },
      ],
    });
    await host.projects.create({ id, name: "Recovered project name" });
    expect(await catalog()).toMatchObject({ projects: [{ id, name: "Recovered project name" }] });
  } finally {
    await host.close();
    await manager.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});

test("only explicit Download restores a cloud-only copy and prepares its local folder when ready", async () => {
  const root = await mkdtemp(join(tmpdir(), "explicit-cloud-download-"));
  const host = await createAccountHostFixture(root);
  const id = crypto.randomUUID();
  const name = "Cloud only project";
  const projectPath = `/v1/account/projects/${id}`;
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/v1/account") return Response.json({ features: { relay: true } });
      if (path === "/v1/workbenches") return Response.json([{ workbenchId: id }]);
      return Response.json({ ok: true });
    },
  });
  const started = Promise.withResolvers<void>();
  const finished = Promise.withResolvers<void>();
  const complete = Promise.withResolvers<void>();
  const folder = join(root, "local-folder");
  let ready = false;
  try {
    const { environmentId } = await host.deps.environmentService.get();
    const device = { managerOrigin: manager.url.origin, accountId: "fixture-account", deviceId: environmentId };
    const copies = createProjectCopyStore(host.file);
    await copies.write({ ...device, projectId: id, name, phase: "cloud-only" });
    await createNativeStore(host.file).save({ ...device, relayOrigin: manager.url.origin, token: "fixture-device" });
    host.account.connectProjectCopies({
      async inspect() {
        return { removesManagedFolder: true, providerWorkspaceCount: 0 };
      },
      prepareFolder: () => mkdir(folder),
    });
    host.account.start(
      async () => {},
      async () =>
        ready ? { state: "synced", offlineReady: true } : { state: "first-download-incomplete", offlineReady: false },
      async () => {
        started.resolve();
        await complete.promise;
        await host.projects.create({ id, name });
        ready = true;
        finished.resolve();
      },
    );
    await host.account.refresh();
    expect(await host.projects.get(id)).toBeNull();
    expect(await host.account.catalogProjects()).toMatchObject({ projects: [{ id, presence: "cloud-only" }] });
    expect(await host.projects.get(id)).toBeNull();

    const wrongAccount = new URLSearchParams({ accountId: "another-account", managerOrigin: device.managerOrigin });
    const denied = await host.app.request(`${projectPath}/download?${wrongAccount}`, { method: "POST" });
    expect(denied.status).toBe(400);
    expect(await copies.forAccount(device)).toMatchObject([{ phase: "cloud-only" }]);
    const expected = new URLSearchParams({ accountId: device.accountId, managerOrigin: device.managerOrigin });
    const download = await host.app.request(`${projectPath}/download?${expected}`, { method: "POST" });
    expect(download.status).toBe(202);
    expect(await download.json()).toEqual({ projectId: id, presence: "downloading" });
    await started.promise;
    expect(await host.account.catalogProjects()).toMatchObject({ projects: [{ id, presence: "downloading" }] });
    expect(await host.projects.get(id)).toBeNull();
    await host.account.prepareDownloadedProject(id);
    await expectRejection(lstat(folder)).toMatchObject({ code: "ENOENT" });

    complete.resolve();
    await finished.promise;
    await writeFile(folder, "A file blocks folder preparation");
    await expect(host.account.prepareDownloadedProject(id)).rejects.toMatchObject({ code: "EEXIST" });
    expect((await host.account.catalogProjects()).projects[0]?.downloadError).toBeDefined();
    await rm(folder);
    expect((await host.app.request(`${projectPath}/download?${expected}`, { method: "POST" })).status).toBe(202);
    await host.account.prepareDownloadedProject(id);
    expect(await host.account.catalogProjects()).toMatchObject({ projects: [{ id, presence: "downloaded" }] });
    expect((await lstat(folder)).isDirectory()).toBe(true);
    expect(await copies.forAccount(device)).toEqual([]);
  } finally {
    complete.resolve();
    await host.close();
    await manager.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});

test("reconnecting after Cloud retirement keeps the project's offline edits on the device", async () => {
  const root = await mkdtemp(join(tmpdir(), "cloud-retirement-local-edits-"));
  const databasePath = join(root, "db");
  const storageRoot = join(root, "storage");
  const id = crypto.randomUUID();
  let connected = true;
  let retired = false;
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      if (!connected) return Response.json({ error: "Offline" }, { status: 503 });
      const path = new URL(request.url).pathname;
      if (path === "/v1/account") return Response.json({ features: { relay: true }, projectDeletion: true });
      if (path === "/v1/workbenches") return Response.json(retired ? [] : [{ workbenchId: id }]);
      if (path === "/v1/project-deletions") return Response.json([]);
      if (path === "/v1/devices/presence") return Response.json({ ok: true });
      return Response.json({ error: "Unavailable" }, { status: 503 });
    },
  });
  const host = await createTestApp({ databasePath, storageRoot });
  try {
    const name = "Project edited offline";
    await host.deps.projectService.create({ id, name });
    const { environmentId } = await host.deps.environmentService.get();
    const store = createNativeStore(nativeAccountFile(databasePath, storageRoot));
    await store.save({
      managerOrigin: manager.url.origin,
      relayOrigin: manager.url.origin,
      accountId: "owner",
      deviceId: environmentId,
      token: "device-token",
    });
    await host.deps.accountService.refresh();
    expect((await host.deps.accountService.status()).cloudProjects).toContain(id);

    const partialId = crypto.randomUUID();
    await host.deps.accountService.recordCloudDiscovery(
      {
        workbenchId: partialId,
        accountId: "owner",
        environmentId,
        managerOrigin: manager.url.origin,
        relayOrigin: manager.url.origin,
        renewalGrant: "device-token",
      },
      "A partial download",
    );
    await host.deps.projectService.create({ id: partialId, name: "A partial download" });

    connected = false;
    await host.deps.accountService.refresh();
    const records = (
      await host.deps.extensionStorageService.open({
        owner: { workbenchId: id, extensionId: "example.notes" },
      })
    ).records;
    await records.commit({
      operationId: "offline-edit",
      edits: [{ recordId: "note", replace: "This was written offline." }],
    });

    retired = true;
    connected = true;
    await host.deps.accountService.refresh();
    expect(await host.deps.accountService.projectSyncStatus(id)).toMatchObject({ state: "local" });
    expect(await host.deps.accountService.projectSyncStatus(partialId)).toEqual({
      state: "first-download-incomplete",
      offlineReady: false,
    });
    expect(await host.deps.projectService.get(id)).toMatchObject({ id, name });
    expect(await records.read("note")).toMatchObject({ exists: true, value: "This was written offline." });
  } finally {
    await host.close();
    await manager.stop(true);
    await rm(root, { recursive: true, force: true });
  }
});
