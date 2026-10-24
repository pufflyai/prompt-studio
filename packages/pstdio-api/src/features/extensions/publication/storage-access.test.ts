import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNativeAccount } from "../../../services/account/native-account";
import { createNativeStore } from "../../../services/account/native-store";
import { createSharedArtifactMount } from "../../../services/shared-files/artifact-mount";
import { createTestApp } from "../../../test-utils/create-test-app";
import { createStorageApi } from "../command-environment/storage";
import { createTestExtensionSource } from "../test-utils/create-test-extension-source";
import { openPublishedCatalog } from "./catalog";
import { documentPeer } from "./document-peer.fixture";
import { createPublicationStorageAccess } from "./storage-access";

let root: string;
let app: Awaited<ReturnType<typeof createTestApp>>;
const cloudProjects: string[] = [];
const peer = documentPeer(cloudProjects);
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "publication-access-"));
  app = await createTestApp({ storageRoot: join(root, "storage") });
});
afterAll(async () => {
  await app.close();
  await peer.close();
  await rm(root, { recursive: true, force: true });
});

test("publishing in a local project preserves its source's data migrations", async () => {
  const project = await app.deps.projectService.create({ name: "Local migrations" });
  const source = createTestExtensionSource({
    root,
    name: "local-access",
    installName: "local-access",
    displayName: "Local access",
    version: "1.0.0",
  });
  const { instance } = await app.deps.extensionService.enableInstalledSourceForProject({
    projectId: project.id,
    sourcePath: source,
    name: "local-access",
    installName: "local-access",
    displayName: "Local access",
    extensionId: "test.local-access",
    version: "1.0.0",
    manifest: {},
  });
  const storage = createStorageApi(app.deps, {
    projectId: project.id,
    extensionId: "test.local-access",
    extensionInstanceId: instance.id,
  });
  const catalog = await openPublishedCatalog(app.deps, project.id);
  const asset = await app.deps.assetTransferService.stage(
    { workbenchId: project.id, extensionId: "pstdio.published-extensions" },
    crypto.randomUUID(),
    new Blob(["local"]),
  );
  await catalog.select(
    { extensionId: "test.local-access", revision: asset.sha256, version: "1.0.0", enabled: true },
    asset,
  );
  await storage.migrate(1, async () => {
    await storage.set("migration", "ran");
  });
  expect(await storage.get<string>("migration")).toBe("ran");
});

test("an unpublished extension in a cloud project runs its own data migrations", async () => {
  const project = await app.deps.projectService.create({ name: "Unpublished migrations" });
  const source = createTestExtensionSource({
    root,
    name: "unpublished-access",
    installName: "unpublished-access",
    displayName: "Unpublished access",
    version: "1.0.0",
  });
  const { instance } = await app.deps.extensionService.enableInstalledSourceForProject({
    projectId: project.id,
    sourcePath: source,
    name: "unpublished-access",
    installName: "unpublished-access",
    displayName: "Unpublished access",
    extensionId: "test.unpublished-access",
    version: "1.0.0",
    manifest: {},
  });
  const login = { managerOrigin: peer.origin, relayOrigin: peer.origin, accountId: "owner", deviceId: "device" };
  const status = async () => ({ login, cloudProjects: [project.id], cloudProjectsLoaded: true, features: null });
  const storage = createStorageApi(
    { ...app.deps, accountService: { ...app.deps.accountService, status } },
    { projectId: project.id, extensionId: "test.unpublished-access", extensionInstanceId: instance.id },
  );
  await storage.migrate(1, async () => {
    await storage.set("migration", "ran");
  });
  expect(await storage.get<string>("migration")).toBe("ran");
});

test("a private override cannot migrate while cloud membership is still unknown", async () => {
  const project = await app.deps.projectService.create({ name: "Unknown membership" });
  const source = createTestExtensionSource({
    root,
    name: "offline-access",
    installName: "offline-access",
    displayName: "Offline access",
    version: "1.0.0",
  });
  const { instance } = await app.deps.extensionService.enableInstalledSourceForProject({
    projectId: project.id,
    sourcePath: source,
    name: "offline-access",
    installName: "offline-access",
    displayName: "Offline access",
    extensionId: "test.offline-access",
    version: "1.0.0",
    manifest: {},
  });
  const catalog = await openPublishedCatalog(app.deps, project.id);
  const asset = await app.deps.assetTransferService.stage(
    { workbenchId: project.id, extensionId: "pstdio.published-extensions" },
    crypto.randomUUID(),
    new Blob(["offline"]),
  );
  await catalog.select(
    { extensionId: "test.offline-access", revision: asset.sha256, version: "1.0.0", enabled: true },
    asset,
  );
  const file = join(root, "undiscovered-account.json");
  await createNativeStore(file).save({
    managerOrigin: peer.origin,
    relayOrigin: peer.origin,
    accountId: "owner",
    deviceId: (await app.deps.environmentService.get()).environmentId,
    token: "wire-credential",
  });
  const account = createNativeAccount({
    file,
    environment: app.deps.environmentService,
    projects: app.deps.projectService,
  });
  try {
    expect(await account.status()).toMatchObject({ cloudProjects: [], cloudProjectsLoaded: false });
    expect((await account.projectSyncStatus(project.id)).state).toBe("offline");
    const deps = {
      ...app.deps,
      accountService: {
        ...app.deps.accountService,
        status: account.status,
        projectSyncStatus: account.projectSyncStatus,
      },
    };
    const access = createPublicationStorageAccess(deps, {
      projectId: project.id,
      extensionId: "test.offline-access",
      extensionInstanceId: instance.id,
    });
    expect(await access.migrate()).toBe(false);
  } finally {
    account.close();
  }
});

test("local overrides sync their edits but never run data migrations; older versions can only read", async () => {
  try {
    const project = await app.deps.projectService.create({ name: "Cloud" });
    const source = createTestExtensionSource({
      root,
      name: "access",
      installName: "access",
      displayName: "Access",
      version: "1.0.0",
    });
    const { instance } = await app.deps.extensionService.enableInstalledSourceForProject({
      projectId: project.id,
      sourcePath: source,
      name: "access",
      installName: "access",
      displayName: "Access",
      extensionId: "test.access",
      version: "1.0.0",
      manifest: {},
    });
    const storage = createStorageApi(app.deps, {
      extensionId: "test.access",
      extensionInstanceId: instance.id,
      projectId: project.id,
    });
    const catalog = await openPublishedCatalog(app.deps, project.id);
    const select = async (version: string) => {
      const asset = await app.deps.assetTransferService.stage(
        { workbenchId: project.id, extensionId: "pstdio.published-extensions" },
        crypto.randomUUID(),
        new Blob([version]),
      );
      await catalog.select({ extensionId: "test.access", revision: asset.sha256, version, enabled: true }, asset);
    };
    cloudProjects.push(project.id);
    await createNativeStore(join(root, "storage", "native-account.json")).save({
      managerOrigin: peer.origin,
      relayOrigin: peer.origin,
      accountId: "owner",
      deviceId: (await app.deps.environmentService.get()).environmentId,
      token: "wire-credential",
    });
    await app.deps.accountService.refresh();
    let migrations = 0;
    await select("1.0.0");
    await storage.migrate(1, async () => {
      migrations++;
      await storage.set("migration", true);
    });
    expect(migrations).toBe(0);
    await storage.set("note", "private code, shared data");
    expect(await storage.get<string>("note")).toBe("private code, shared data");
    const file = await storage.files.put({ name: "existing.txt", data: new Uint8Array([1]) });
    const mount = createSharedArtifactMount(app.deps, {
      projectId: project.id,
      extensionId: "test.access",
      repoRoot: root,
      name: "access",
      mountPath: "documents",
      assertWritable: createPublicationStorageAccess(app.deps, {
        projectId: project.id,
        extensionId: "test.access",
        extensionInstanceId: instance.id,
      }).write,
    });
    await mount.writeText("note.md", "shared artifact");
    await select("2.0.0");
    expect(await mount.readText("note.md")).toBe("shared artifact");
    await expect(mount.writeText("note.md", "old writer")).rejects.toThrow("Update");
    const upload = await app.app.request(`/v1/projects/${project.id}/extensions/${instance.id}/files`, {
      method: "POST",
      headers: { "content-type": "application/octet-stream" },
      body: "old upload",
    });
    expect(upload.status).toBe(409);
    const deletion = await app.app.request(`/v1/projects/${project.id}/extensions/${instance.id}/files/${file.id}`, {
      method: "DELETE",
    });
    expect(deletion.status).toBe(409);
    expect(await storage.get<string>("note")).toBe("private code, shared data");
    await expect(storage.set("note", "old writer")).rejects.toThrow("Update");
    await expect(
      storage.records.commit({
        operationId: crypto.randomUUID(),
        edits: [{ recordId: storage.records.id("note"), replace: "old writer" }],
      }),
    ).rejects.toThrow("Update");
    await expect(storage.collection("notes").put("one", {})).rejects.toThrow("Update");
    await expect(storage.files.put({ name: "old.txt", data: new Uint8Array([1]) })).rejects.toThrow("Update");
    await expect(
      app.deps.extensionFileService.upload({
        project_id: project.id,
        extension_instance_id: instance.id,
        scope_type: "project",
        scope_id: project.id,
        file_name: "bypass.txt",
        data: Buffer.from("old writer"),
      }),
    ).rejects.toThrow("Update");
    await expect(
      app.deps.extensionFileService.remove({
        project_id: project.id,
        extension_instance_id: instance.id,
        file_id: file.id,
      }),
    ).rejects.toThrow("Update");
    expect((await storage.files.getBytes(file.id))[0]).toBe(1);
    await storage.migrate(2, async () => {
      migrations++;
    });
    expect(migrations).toBe(0);
  } finally {
    await app.deps.accountService.logout();
  }
});

test("a selection whose package cannot be read blocks shared writes and migrations", async () => {
  const project = await app.deps.projectService.create({ name: "Damaged selection" });
  const source = createTestExtensionSource({
    root,
    name: "damaged-access",
    installName: "damaged-access",
    displayName: "Damaged access",
    version: "1.0.0",
  });
  const { instance } = await app.deps.extensionService.enableInstalledSourceForProject({
    projectId: project.id,
    sourcePath: source,
    name: "damaged-access",
    installName: "damaged-access",
    displayName: "Damaged access",
    extensionId: "test.damaged-access",
    version: "1.0.0",
    manifest: {},
  });
  const catalog = await openPublishedCatalog(app.deps, project.id);
  const asset = await app.deps.assetTransferService.stage(
    { workbenchId: project.id, extensionId: "pstdio.published-extensions" },
    crypto.randomUUID(),
    new Blob(["damaged"]),
  );
  await catalog.select(
    { extensionId: "test.damaged-access", revision: asset.sha256, version: "1.0.0", enabled: true },
    asset,
  );
  await catalog.records.commit({
    operationId: crypto.randomUUID(),
    edits: [{ recordId: `package:${asset.sha256}`, deleted: true }],
  });
  const storage = createStorageApi(app.deps, {
    projectId: project.id,
    extensionId: "test.damaged-access",
    extensionInstanceId: instance.id,
  });
  await expect(storage.set("note", "write")).rejects.toThrow("Update");
  let migrations = 0;
  await storage.migrate(1, async () => {
    migrations++;
  });
  expect(migrations).toBe(0);
});
