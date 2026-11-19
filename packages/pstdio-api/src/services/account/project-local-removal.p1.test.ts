import { expect, test } from "bun:test";
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkspaceTypeProvider } from "pstdio-api-contracts/extension-kernel";
import { openProject } from "../../features/projects/open-project";
import { remoteWorkspaceCapabilities } from "../../features/workspaces/workspace-provider.test-fixture";
import type { WorkspaceProviderRuntime } from "../../features/workspaces/workspace-provider-runtime";
import { createTestApp } from "../../test-utils/create-test-app";
import { historyNamespace } from "../personal-history/log-files";
import { projectRecoveryRoot } from "../project-recovery/project-paths";
import { nativeAccountFile } from "./native-account";
import { createNativeStore } from "./native-store";
import { createProjectCopyStore } from "./project-copy-store";

const openHost = (root: string) =>
  createTestApp({ databasePath: join(root, "db"), storageRoot: join(root, "storage") });

const request = (host: Awaited<ReturnType<typeof openHost>>, path: string, body?: object) =>
  host.app.request(
    `/v1${path}`,
    body
      ? {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );

const settleCleanup = async (actions: unknown[]) => {
  const results = await Promise.allSettled(actions);
  const failure = results.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
};

test("an offline saved roster cannot authorize deletion of a project another device enables in Cloud", async () => {
  const root = await mkdtemp(join(tmpdir(), "cached-cloud-deletion-"));
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const id = crypto.randomUUID();
  let enabled = false;
  let offline = false;
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(input) {
      const path = new URL(input.url).pathname;
      if (offline) return Response.json({ error: "offline" }, { status: 503 });
      if (path === "/v1/account") return Response.json({ features: { relay: true } });
      if (path === "/v1/workbenches") return Response.json(enabled ? [{ workbenchId: id }] : []);
      return Response.json({ ok: true });
    },
  });
  let host: Awaited<ReturnType<typeof openHost>> | undefined;
  try {
    host = await openHost(root);
    await host.deps.projectService.create({ id, name: "New Cloud project" });
    const file = await host.deps.fileService.upload({
      project_id: id,
      file_name: "local-only.txt",
      file_kind: "attachment",
      data: Buffer.from("Unpublished work"),
    });
    const { environmentId } = await host.deps.environmentService.get();
    const store = createNativeStore(nativeAccountFile(join(root, "db"), join(root, "storage")));
    await store.save({
      managerOrigin: manager.url.origin,
      relayOrigin: manager.url.origin,
      accountId: "account",
      deviceId: environmentId,
      token: "device-credential",
    });
    await host.deps.accountService.refresh();
    expect((await host.deps.accountService.status()).cloudProjectsLoaded).toBe(true);
    enabled = true;
    offline = true;
    await host.deps.accountService.refresh();
    expect((await host.app.request(`/v1/projects/${id}`, { method: "DELETE" })).status).toBe(409);
    expect(await host.deps.projectService.get(id)).not.toBeNull();
    expect(await readFile(file.storage_path, "utf8")).toBe("Unpublished work");
    expect((await host.deps.accountService.status()).cloudProjectsLoaded).toBe(false);
  } finally {
    try {
      await settleCleanup([host?.close(), manager.stop(true)]);
    } finally {
      if (previousHome === undefined) delete process.env.PSTDIO_HOME;
      else process.env.PSTDIO_HOME = previousHome;
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("removing a local copy preserves its source folder and stays removed after a same-account login", async () => {
  const root = await mkdtemp(join(tmpdir(), "local-project-removal-"));
  const previousHome = process.env.PSTDIO_HOME;
  const previousDefaults = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  const id = crypto.randomUUID();
  const name = "Project with a source folder";
  let cloudAvailable = true;
  const manager = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(input) {
      if (!cloudAvailable) return Response.json({ error: "offline" }, { status: 503 });
      const { pathname } = new URL(input.url);
      if (pathname === "/v1/account") return Response.json({ features: { relay: true } });
      if (pathname === "/v1/workbenches") return Response.json([{ workbenchId: id }]);
      if (pathname === "/v1/project-deletions") return Response.json([]);
      if (pathname === "/v1/devices/presence") return Response.json({ ok: true });
      return Response.json({ error: "unavailable" }, { status: 503 });
    },
  });
  let host: Awaited<ReturnType<typeof openHost>> | undefined;
  let secondDevice: Awaited<ReturnType<typeof openHost>> | undefined;
  const storageRoot = join(root, "storage");
  const store = createNativeStore(nativeAccountFile(join(root, "db"), storageRoot));
  try {
    const folder = join(root, "source");
    await mkdir(folder);
    const sourceFile = join(folder, "hello.txt");
    await writeFile(sourceFile, "Keep the original source.");
    host = await openHost(root);
    const { environmentId } = await host.deps.environmentService.get();
    const login = {
      accountId: "account",
      deviceId: environmentId,
      managerOrigin: manager.url.origin,
      relayOrigin: manager.url.origin,
      token: "first-test-credential",
    };
    await host.deps.projectService.create({ id, name });
    await host.deps.workspaceService.ensureDefault({ project_id: id, name: "Project folder", root_path: folder });
    const owner = { workbenchId: id, extensionId: "example.offline-notes" };
    const data = await host.deps.extensionStorageService.open({ owner });
    const unopened = await host.deps.extensionStorageService.open({
      owner: { ...owner, extensionId: "example.not-yet-open" },
    });
    await data.records.commit({
      operationId: "local-save",
      edits: [
        { recordId: "note", expectedRevision: (await data.records.read("note")).revision, replace: "local edit" },
      ],
    });
    await data.records.defineIndexes([{ name: "notes", fields: { title: { path: ["title"], type: "string" } } }]);
    const attachment = await host.deps.fileService.upload({
      project_id: id,
      file_name: "note.txt",
      file_kind: "attachment",
      data: Buffer.from("Only on this device"),
    });
    const cache = projectRecoveryRoot(host.deps.projectRecovery.root, id);
    await mkdir(cache, { recursive: true });
    await writeFile(join(cache, "retained-copy"), "Local recovery");
    const historyPath = join(storageRoot, "personal-history", historyNamespace({ ...login, projectId: id }));
    await host.deps.personalHistoryService.logs.append(historyNamespace({ ...login, projectId: id }), "session", [
      "log",
    ]);
    const secondRoot = join(root, "second");
    secondDevice = await openHost(secondRoot);
    const secondId = (await secondDevice.deps.environmentService.get()).environmentId;
    const secondStore = createNativeStore(nativeAccountFile(join(secondRoot, "db"), join(secondRoot, "storage")));
    await secondDevice.deps.projectService.create({ id, name });
    await secondStore.save({ ...login, deviceId: secondId, token: "second-device" });
    await secondDevice.deps.accountService.refresh();

    await store.save(login);
    cloudAvailable = false;
    await host.deps.accountService.refresh();
    expect((await host.deps.accountService.status()).cloudProjectsLoaded).toBe(false);
    expect((await host.app.request(`/v1/projects/${id}`, { method: "DELETE" })).status).toBe(409);

    cloudAvailable = true;
    await host.deps.accountService.refresh();
    expect((await host.app.request(`/v1/projects/${id}`, { method: "DELETE" })).status).toBe(409);

    const projectPath = `/account/projects/${id}`;
    const before = await request(host, `${projectPath}/local-removal`);
    expect(before.status).toBe(200);
    expect(await before.json()).toMatchObject({ uploadState: "unknown" });
    const denied = await request(host, `${projectPath}/remove-local`, {});
    expect(denied.status).toBe(409);
    expect(await host.deps.projectService.get(id)).not.toBeNull();
    expect(await data.records.read("note")).toMatchObject({ exists: true });

    const stopped = Promise.withResolvers<void>();
    let signal: AbortSignal | undefined;
    const writer = host.deps.projectService.work.run(id, async (admitted) => {
      signal = admitted;
      await stopped.promise;
    });
    const removing = request(host, `${projectPath}/remove-local`, { discardUnsynced: true });
    try {
      for (let attempt = 0; !host.deps.projectService.work.blocked(id); attempt++) {
        if (attempt === 50) throw new Error("Local removal did not close write admission");
        await Bun.sleep(10);
      }
      expect(signal?.aborted).toBe(false);
      await expect(
        data.records.commit({ operationId: "late-edit", edits: [{ recordId: "late", replace: "late" }] }),
      ).rejects.toThrow("This device is removing");
      await expect(unopened.records.read("note")).rejects.toThrow("This device is removing");
      await expect(unopened.records.outcome("late-edit")).rejects.toThrow("This device is removing");
      await expect(data.records.defineIndexes([])).rejects.toThrow("This device is removing");
      await expect(data.records.query({ index: "notes" })).rejects.toThrow("This device is removing");
      await expect(data.records.aggregate({ index: "notes" })).rejects.toThrow("This device is removing");
      expect(await lstat(attachment.storage_path)).toBeDefined();
    } finally {
      stopped.resolve();
    }
    await writer;
    expect((await removing).status).toBe(200);
    expect(await host.deps.projectService.get(id)).toBeNull();
    for (const path of [attachment.storage_path, cache, historyPath])
      await expect(lstat(path)).rejects.toMatchObject({ code: "ENOENT" });
    expect(await readFile(sourceFile, "utf8")).toBe("Keep the original source.");
    await secondDevice.deps.accountService.refresh();
    expect(await secondDevice.deps.projectService.get(id)).toMatchObject({ id, name });
    const catalog = async () => (await request(host!, "/account/projects")).json();
    const removed = { id, name, presence: "cloud-only" };
    expect(await catalog()).toMatchObject({ projects: [removed] });

    await host.close();
    host = undefined;
    cloudAvailable = false;
    host = await openHost(root);
    expect(await catalog()).toMatchObject({ projects: [removed] });
    expect(await host.deps.projectService.get(id)).toBeNull();

    cloudAvailable = true;
    await store.forget(login.token);
    await host.deps.accountService.refresh();
    await store.save({ ...login, token: "replacement-test-credential" });
    await host.deps.accountService.refresh();
    expect(await catalog()).toMatchObject({ projects: [removed] });
    expect(await host.deps.projectService.get(id)).toBeNull();
  } finally {
    await secondDevice?.close();
    await host?.close();
    await manager.stop(true);
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    if (previousDefaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    else process.env.PSTDIO_DEFAULT_EXTENSIONS = previousDefaults;
    await rm(root, { recursive: true, force: true });
  }
});

test("provider failure leaves removal resumable and keeps the managed folder until retry succeeds", async () => {
  const root = await mkdtemp(join(tmpdir(), "local-project-removal-retry-"));
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const id = crypto.randomUUID();
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
  let host: Awaited<ReturnType<typeof openHost>> | undefined;
  try {
    host = await openHost(root);
    await host.deps.projectService.create({ id, name: "Managed folder with a provider workspace" });
    const home = await openProject(host.deps, id);
    const folder = home!.root_path!;
    const copy = join(folder, "downloaded.txt");
    await writeFile(copy, "The app owns this folder.");
    const providerId = "example.remote";
    const extra = await host.deps.workspaceService.create({
      project_id: id,
      name: "Provider workspace",
      shorthand_base: "W",
      provider_id: providerId,
    });
    await host.deps.workspaceService.updateProviderProjection(extra.id, {
      execution_kind: "remote",
      provider_state: "ready",
      provider_capabilities_json: remoteWorkspaceCapabilities,
      provider_ref_json: { version: 1, data: { handle: "our-workspace" } },
    });
    const attempts: string[] = [];
    const provider = {
      delete: async (_ctx, operation) => {
        expect(await host!.deps.projectService.get(id)).toMatchObject({ id });
        attempts.push(operation.operationId);
        if (attempts.length === 1) throw new Error("Provider temporarily unavailable");
      },
    } satisfies Pick<WorkspaceTypeProvider, "delete">;
    Object.assign(host.deps, {
      workspaceProviderRuntime: {
        find: async () => ({ context: {} as never, provider: provider as WorkspaceTypeProvider }),
      } satisfies WorkspaceProviderRuntime,
    });
    const { environmentId } = await host.deps.environmentService.get();
    const store = createNativeStore(nativeAccountFile(join(root, "db"), join(root, "storage")));
    await store.save({
      accountId: "account",
      deviceId: environmentId,
      managerOrigin: manager.url.origin,
      relayOrigin: manager.url.origin,
      token: "device",
    });
    await host.deps.accountService.refresh();

    const path = `/account/projects/${id}`;
    expect(await (await request(host, `${path}/local-removal`)).json()).toMatchObject({
      removesManagedFolder: true,
      providerWorkspaceCount: 1,
    });
    expect((await request(host, `${path}/remove-local`, { discardUnsynced: true })).status).toBe(503);
    expect(await host.deps.projectService.get(id)).toBeNull();
    expect(await readFile(copy, "utf8")).toBe("The app owns this folder.");
    expect(await (await request(host, "/projects/query")).json()).toMatchObject({ items: [] });
    const write = await host.app.request(`/v1/workspaces/${home!.id}/file?path=late.txt`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Avoid a write during cleanup" }),
    });
    expect(write.status).toBe(409);
    expect(await (await request(host, "/account/projects")).json()).toMatchObject({
      projects: [{ id, presence: "removing" }],
    });
    expect((await request(host, `${path}/remove-local`, {})).status).toBe(200);
    expect(attempts).toEqual([attempts[0], attempts[0]]);
    await expect(lstat(folder)).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    try {
      await settleCleanup([host?.close(), manager.stop(true)]);
    } finally {
      if (previousHome === undefined) delete process.env.PSTDIO_HOME;
      else process.env.PSTDIO_HOME = previousHome;
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("restart resumes a device removal whose consent was saved before cleanup began", async () => {
  const root = await mkdtemp(join(tmpdir(), "local-project-removal-interrupted-"));
  const id = crypto.randomUUID();
  const name = "Accepted removal";
  const path = nativeAccountFile(join(root, "db"), join(root, "storage"));
  const copies = createProjectCopyStore(path);
  let host: Awaited<ReturnType<typeof openHost>> | undefined;
  try {
    host = await openHost(root);
    const { environmentId: deviceId } = await host.deps.environmentService.get();
    const account = { managerOrigin: "http://127.0.0.1:1", accountId: "account", deviceId };
    await host.deps.projectService.create({ id, name });
    const file = await host.deps.fileService.upload({
      project_id: id,
      file_name: "retained-before-restart",
      file_kind: "attachment",
      data: Buffer.from("previous local bytes"),
    });
    await copies.write({ ...account, projectId: id, name, phase: "removing" });
    await host.close();
    host = await openHost(root);

    expect(await host.deps.projectService.get(id)).toBeNull();
    for (let attempt = 0; (await copies.forAccount(account))[0]?.phase !== "cloud-only"; attempt++) {
      if (attempt === 50) throw new Error("Startup did not finish the persisted project removal");
      await Bun.sleep(10);
    }
    await expect(lstat(file.storage_path)).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await host?.close();
    await rm(root, { recursive: true, force: true });
  }
});
