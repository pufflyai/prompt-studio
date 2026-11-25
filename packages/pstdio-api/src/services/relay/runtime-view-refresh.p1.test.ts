import { expect, spyOn, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace } from "pstdio-sync/encryption";
import * as mountWatcher from "../../features/extensions/artifact-mount-watch/mount-watcher";
import { createRecordAssets } from "../../features/extensions/command-environment/record-assets";
import { loadExtensionSource } from "../../features/extensions/extension-runtime";
import { documentPeer } from "../../features/extensions/publication/document-peer.fixture";
import { createTestExtensionSource } from "../../features/extensions/test-utils/create-test-extension-source";
import { initializeProjectWorkspace } from "../../features/projects/project-folder";
import { createTestApp } from "../../test-utils/create-test-app";
import { createSharedArtifactMount } from "../shared-files/artifact-mount";
import { type RelayWorkbench, startRelayRuntime } from "./runtime";

test("finishing views keeps downloaded Cloud documents subscribed without downloading them again", async () => {
  const root = await mkdtemp(join(tmpdir(), "cloud-view-refresh-"));
  const app = await createTestApp({ storageRoot: join(root, "home") });
  const reads: string[] = [];
  const owner = { workbenchId: crypto.randomUUID(), extensionId: "test.notes" };
  const space = await createSyncSpace({
    projectId: owner.workbenchId,
    spaceOwner: null,
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const documents = new Set(
    await Promise.all(
      ["owner", "record-stream-v2"].map((name) => space.documentId(JSON.stringify([owner.extensionId, name]))),
    ),
  );
  const peer = documentPeer([], {
    onRead: (id) => {
      if (documents.has(id)) reads.push(id);
    },
  });
  let runtime: Awaited<ReturnType<typeof startRelayRuntime>> | undefined;
  const synced = async () => {
    const end = Date.now() + 3000;
    do {
      if ((await runtime!.status(owner.workbenchId)).state === "synced") return;
      await Bun.sleep(10);
    } while (Date.now() < end);
    expect((await runtime!.status(owner.workbenchId)).state).toBe("synced");
  };
  try {
    await app.deps.projectService.create({ id: owner.workbenchId, name: "Shared notes" });
    const folder = join(root, "checkout");
    await mkdir(folder);
    await initializeProjectWorkspace(
      app.deps,
      owner.workbenchId,
      { provider_id: "pstdio.root", params: { path: folder } },
      async () => [],
    );
    const path = createTestExtensionSource({
      root: join(root, "source"),
      installName: "notes",
      name: "notes",
      displayName: "Notes",
      version: "1.0.0",
    });
    const source = await loadExtensionSource(path);
    await app.deps.extensionService.enableInstalledSourceForProject({
      projectId: owner.workbenchId,
      sourcePath: path,
      extensionId: source.metadata.id,
      installName: "notes",
      name: "notes",
      displayName: "Notes",
      manifest: source.manifest,
      version: "1.0.0",
    });
    const environmentId = (await app.deps.environmentService.get()).environmentId;
    const prior = await app.deps.accountService.status();
    app.deps.accountService.status = async () => ({
      ...prior,
      login: { accountId: "owner", deviceId: environmentId, managerOrigin: peer.origin, relayOrigin: peer.origin },
      cloudProjects: [owner.workbenchId],
      cloudProjectsLoaded: true,
    });
    app.deps.accountService.devices = async () => [];
    const config: RelayWorkbench = {
      accountId: "owner",
      workbenchId: owner.workbenchId,
      environmentId,
      managerOrigin: peer.origin,
      relayOrigin: peer.origin,
      renewalGrant: "fixture",
    };
    const store = await app.deps.extensionStorageService.open({
      owner,
      assets: createRecordAssets(app.deps.assetTransferService, owner),
    });
    await store.records.commit({ operationId: "initial", edits: [{ recordId: "note", replace: "before" }] });
    runtime = await startRelayRuntime({ deps: app.deps });
    await runtime.update([config]);
    await synced();
    const initialReads = reads.length;
    expect(initialReads).toBeGreaterThan(0);
    const initial = await app.deps.extensionRuntimeCatalog.get(owner.workbenchId);
    app.deps.extensionRuntimeCatalog.invalidate({ projectId: owner.workbenchId, reason: "webviews_built" });
    await runtime.update([config]);
    const refreshed = await app.deps.extensionRuntimeCatalog.get(owner.workbenchId);
    expect(refreshed.generation).toBeGreaterThan(initial.generation);
    await synced();
    expect(reads.length).toBe(initialReads);
    await store.records.commit({ operationId: "after-view", edits: [{ recordId: "note", replace: "after" }] });
    await synced();
    expect((await store.records.read("note")).value).toBe("after");
    expect(reads.length).toBeGreaterThan(initialReads);
    const beforeSourceChange = reads.length;
    const packagePath = join(path, "package.json");
    const manifest = JSON.parse(await readFile(packagePath, "utf8"));
    await writeFile(packagePath, JSON.stringify({ ...manifest, version: "1.0.1" }));
    await app.deps.extensionService.reloadInstalledSourceBySourcePath(path);
    await runtime.update([config]);
    await synced();
    expect(reads.length).toBeGreaterThan(beforeSourceChange);
    expect((await store.records.read("note")).value).toBe("after");
    const beforeWorkspaceChange = reads.length;
    const workspace = await app.deps.workspaceService.getDefault(owner.workbenchId);
    const nextFolder = join(root, "new-checkout");
    await mkdir(nextFolder);
    await app.deps.workspaceService.updateProviderProjection(workspace!.id, { root_path: nextFolder });
    await runtime.update([config]);
    await synced();
    expect(reads.length).toBeGreaterThan(beforeWorkspaceChange);
  } finally {
    await runtime?.close();
    await app.close();
    await peer.close();
    await rm(root, { recursive: true, force: true });
  }
});

test.each([
  false,
  true,
])("finishing setup projects downloaded artifacts (sender watch initially fails: %s)", async (watchFails) => {
  const root = await mkdtemp(join(tmpdir(), "cloud-ready-mount-"));
  const apps = await Promise.all(
    ["sender", "receiver"].map((name) => createTestApp({ storageRoot: join(root, name) })),
  );
  const peer = documentPeer();
  const owner = { workbenchId: crypto.randomUUID(), extensionId: "test.notes" };
  const runtimes: Awaited<ReturnType<typeof startRelayRuntime>>[] = [];
  const configs: RelayWorkbench[] = [];
  const folders = [join(root, "sender-checkout"), join(root, "receiver-checkout")];
  const senderMount = join("sender-checkout", ".pstdio", "extension-storage", owner.extensionId, "documents");
  const openWatch = mountWatcher.watchArtifactMount;
  let allowWatch = !watchFails;
  let attempts = 0;
  let recovered = 0;
  let closed = 0;
  const native = watchFails
    ? spyOn(mountWatcher, "watchArtifactMount").mockImplementation((input) => {
        if (!input.root.endsWith(senderMount)) return openWatch(input);
        attempts++;
        if (!allowWatch) throw Object.assign(new Error("Native artifact watch is unavailable"), { code: "ENOSPC" });
        const watcher = openWatch(input);
        recovered++;
        return {
          close: () => {
            watcher.close();
            closed++;
          },
        };
      })
    : undefined;
  const synced = async (runtime: Awaited<ReturnType<typeof startRelayRuntime>>) => {
    const end = Date.now() + 3000;
    let observed = await runtime.status(owner.workbenchId);
    while (observed.state !== "synced" && Date.now() < end) {
      await Bun.sleep(10);
      observed = await runtime.status(owner.workbenchId);
    }
    expect(observed.state).toBe("synced");
  };
  try {
    for (const [index, app] of apps.entries()) {
      await app.deps.projectService.create({ id: owner.workbenchId, name: "Downloaded files" });
      await mkdir(folders[index]!);
      await initializeProjectWorkspace(
        app.deps,
        owner.workbenchId,
        { provider_id: "pstdio.root", params: { path: folders[index]! } },
        async () => [],
      );
      const path = createTestExtensionSource({
        root: join(root, `source-${index}`),
        installName: "notes",
        name: "notes",
        displayName: "Notes",
        version: "1.0.0",
      });
      await writeFile(
        join(path, "extension.ts"),
        `export default { artifactMounts: [
        { id: "documents", ref: { kind: "artifact-mount", id: "documents" }, path: "documents", label: "Documents", watch: false }
      ] };`,
      );
      const source = await loadExtensionSource(path);
      await app.deps.extensionService.enableInstalledSourceForProject({
        projectId: owner.workbenchId,
        sourcePath: path,
        extensionId: source.metadata.id,
        installName: "notes",
        name: "notes",
        displayName: "Notes",
        manifest: source.manifest,
        version: "1.0.0",
      });
      const environmentId = (await app.deps.environmentService.get()).environmentId;
      const prior = await app.deps.accountService.status();
      app.deps.accountService.status = async () => ({
        ...prior,
        login: { accountId: "owner", deviceId: environmentId, managerOrigin: peer.origin, relayOrigin: peer.origin },
        cloudProjects: [owner.workbenchId],
        cloudProjectsLoaded: true,
      });
      app.deps.accountService.devices = async () => [];
      configs.push({
        accountId: "owner",
        workbenchId: owner.workbenchId,
        environmentId,
        managerOrigin: peer.origin,
        relayOrigin: peer.origin,
        renewalGrant: "fixture",
      });
    }
    const receiver = apps[1]!;
    const workspace = await receiver.deps.workspaceService.getDefault(owner.workbenchId);
    await receiver.deps.workspaceService.setInitializing(workspace!.id, true);
    const mount = createSharedArtifactMount(apps[0]!.deps, {
      projectId: owner.workbenchId,
      extensionId: owner.extensionId,
      repoRoot: folders[0]!,
      name: "documents",
      mountPath: "documents",
    });
    await mount.writeText("recovered.txt", "Downloaded while setup runs");
    for (const [index, app] of apps.entries()) {
      const runtime = await startRelayRuntime({ deps: app.deps });
      runtimes.push(runtime);
      await runtime.update([configs[index]!]);
      await synced(runtime);
    }
    const file = join(folders[1]!, ".pstdio/extension-storage/test.notes/documents/recovered.txt");
    expect(await Bun.file(file).exists()).toBe(false);
    await receiver.deps.workspaceService.setInitializing(workspace!.id, false);
    await runtimes[1]!.update([configs[1]!]);
    const end = Date.now() + 3000;
    while (!(await Bun.file(file).exists()) && Date.now() < end) await Bun.sleep(10);
    expect(await Bun.file(file).exists()).toBe(true);
    expect(await readFile(file, "utf8")).toBe("Downloaded while setup runs");
    if (watchFails) {
      // The receiver obtained the actual file while the sender still lacked a native watch.
      expect(attempts).toBeGreaterThan(0);
      expect(recovered).toBe(0);
      allowWatch = true;
      const retryDeadline = Date.now() + 3_000;
      while (recovered === 0 && Date.now() < retryDeadline) await Bun.sleep(10);
      expect(recovered).toBe(1);
    }
  } finally {
    await Promise.all(runtimes.map((runtime) => runtime.close()));
    native?.mockRestore();
    await Promise.all(apps.map((app) => app.close()));
    await peer.close();
    await rm(root, { recursive: true, force: true });
  }
  if (watchFails) expect(closed).toBe(1);
}, 8_000);
