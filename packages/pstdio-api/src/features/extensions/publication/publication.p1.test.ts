import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProjectRelayConnection } from "pstdio-sync/relay";
import { createNativeAccount } from "../../../services/account/native-account";
import { createNativeStore } from "../../../services/account/native-store";
import { createExtensionDocumentSync } from "../../../services/relay/documents";
import { projectSyncStatus } from "../../../services/relay/project-status";
import { startPublishedExtensions } from "../../../services/relay/publications";
import { createTestApp } from "../../../test-utils/create-test-app";
import { createStorageApi } from "../command-environment/storage";
import { loadExtensionSource } from "../extension-runtime";
import { createTestExtensionSource } from "../test-utils/create-test-extension-source";
import { activatePublishedSet } from "./activate";
import { openPublishedCatalog, publicationSchema, publishExtension, publishedOwner } from "./catalog";
import { adoptPublishedExtension } from "./change-catalog";
import { documentPeer } from "./document-peer.fixture";
import { packExtension } from "./package";

const root = await mkdtemp(join(tmpdir(), "extension-documents-"));
const projectId = crypto.randomUUID();
const peer = documentPeer([projectId]);
const controller = new AbortController();
const apps: Awaited<ReturnType<typeof createTestApp>>[] = [];
const accounts: ReturnType<typeof createNativeAccount>[] = [];
const config = {
  accountId: "owner",
  workbenchId: projectId,
  environmentId: "device",
  managerOrigin: peer.origin,
  relayOrigin: peer.origin,
  renewalGrant: "grant",
};
const access = async () => ({ token: "wire-access", expiresAt: new Date(Date.now() + 60_000).toISOString() });
const projectRelay = (config: { relayOrigin: string; workbenchId: string }) =>
  createProjectRelayConnection({
    origin: config.relayOrigin,
    projectId: config.workbenchId,
    access,
    signal: controller.signal,
  });
const syncs: ReturnType<typeof createExtensionDocumentSync>[] = [];
const publications: ReturnType<typeof startPublishedExtensions>[] = [];
beforeAll(async () => {
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  for (let index = 0; index < 3; index++) {
    const app = await createTestApp({ storageRoot: join(root, String(index)) });
    apps[index] = app;
    await app.deps.projectService.create({ id: projectId, name: "Cloud project" });
    const file = join(root, String(index), "wire-account.json");
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
    accounts.push(account);
    await account.refresh();
    // Discover real cloud membership while the test drives transport connections explicitly.
    app.deps.accountService.status = account.status;
    app.deps.accountService.projectSyncStatus = account.projectSyncStatus;
    syncs[index] = createExtensionDocumentSync({
      config,
      deps: app.deps,
      owner: publishedOwner(projectId),
      access,
      claim: () => {},
    });
  }
});
afterAll(async () => {
  controller.abort();
  for (const connection of publications) connection.close();
  await Promise.all(publications.map((connection) => connection.done));
  for (const sync of syncs) sync.close();
  for (const account of accounts) account.close();
  await Promise.all(apps.map((app) => app.close()));
  await peer.close();
  await rm(root, { recursive: true, force: true });
});
const sourceFor = async (index: number) =>
  (await apps[index]!.deps.extensionService.listProjectExtensionInstances(projectId))[0]!;
const catalogFor = (index: number) => openPublishedCatalog(apps[index]!.deps, projectId);
const read = async (index: number) => (await catalogFor(index)).read("test.unrelated");
const sync = (index: number) => syncs[index]!.synchronize(controller.signal);
const activate = async (index: number) => {
  const records = (await (await catalogFor(index)).list()).filter(
    (record) => !record.deleted && !record.recordId.startsWith("package:"),
  );
  return activatePublishedSet(
    apps[index]!.deps,
    projectId,
    records.map((record) => ({ publication: publicationSchema.parse(record.value), asset: record.asset! })),
  );
};

test("three devices discover encrypted packages, preserve private overrides and resume interrupted downloads", async () => {
  const a = apps[0]!;
  const source = createTestExtensionSource({
    root,
    installName: "unrelated",
    name: "unrelated",
    displayName: "Unrelated",
    version: "1.0.0",
  });
  await writeFile(join(source, "payload.bin"), Buffer.alloc(300_000, 23));
  const loaded = await loadExtensionSource(source);
  const enabled = await a.deps.extensionService.enableInstalledSourceForProject({
    projectId,
    sourcePath: source,
    extensionId: loaded.metadata.id,
    installName: "unrelated",
    name: "unrelated",
    displayName: "Unrelated",
    manifest: loaded.manifest,
    version: "1.0.0",
  });
  await publishExtension(a.deps, {
    projectId,
    instanceId: enabled.instance.id,
    expectedRevision: (await read(0)).revision,
  });
  await sync(0);
  // Native discovery starts with an empty extension set on B and C.
  for (const index of [1, 2]) {
    const ready = Promise.withResolvers<void>();
    const stop = apps[index]!.deps.eventBus.subscribe((event) => {
      if (event.table === "extension_instances") ready.resolve();
    });
    const connection = startPublishedExtensions({
      config,
      deps: apps[index]!.deps,
      access,
      relay: projectRelay(config),
      signal: controller.signal,
    });
    publications.push(connection);
    await ready.promise;
    stop();
    connection.close();
    await connection.done;
    expect((await sourceFor(index)).installedSource.source_ref).toBe(
      `pstdio-published:${(await read(0)).asset!.sha256}`,
    );
    expect(await readFile(join((await sourceFor(index)).installedSource.source_path, "payload.bin"))).toEqual(
      Buffer.alloc(300_000, 23),
    );
  }
  const privatePath = (await sourceFor(0)).installedSource.source_path;
  const localStorage = createStorageApi(a.deps, {
    projectId,
    extensionId: "test.unrelated",
    extensionInstanceId: enabled.instance.id,
  });
  let migrations = 0;
  await localStorage.migrate(1, async () => {
    migrations++;
  });
  expect(migrations).toBe(0);
  await localStorage.set("note", "shared record from private code");
  const dataSyncs = apps.map((app) =>
    createExtensionDocumentSync({
      config,
      deps: app.deps,
      owner: { workbenchId: projectId, extensionId: "test.unrelated" },
      access,
      claim: () => {},
    }),
  );
  try {
    for (const data of dataSyncs) await data.synchronize(controller.signal);
    const b = await sourceFor(1);
    const bStorage = createStorageApi(apps[1]!.deps, {
      projectId,
      extensionId: "test.unrelated",
      extensionInstanceId: b.instance.id,
    });
    expect(await bStorage.get<string>("note")).toBe("shared record from private code");
    await bStorage.migrate(1, async () => {
      migrations++;
    });
    expect(migrations).toBe(1);
  } finally {
    for (const data of dataSyncs) data.close();
  }
  await writeFile(join(source, "new.txt"), "published second revision");
  await publishExtension(a.deps, {
    projectId,
    instanceId: enabled.instance.id,
    expectedRevision: (await read(0)).revision,
  });
  await sync(0);
  const previous = (await sourceFor(1)).installedSource.id;
  peer.missing(true);
  await expect(sync(1)).rejects.toThrow();
  expect((await sourceFor(1)).installedSource.id).toBe(previous);
  peer.missing(false);
  peer.interrupt();
  await expect(sync(1)).rejects.toThrow();
  await sync(1);
  expect(peer.offsets.at(-1)).toBeGreaterThan(0);
  await activate(1);
  await sync(0);
  await activate(0);
  expect((await sourceFor(0)).installedSource.source_path).toBe(privatePath);
  await adoptPublishedExtension(a.deps, projectId, "test.unrelated", controller.signal);
  expect((await sourceFor(0)).installedSource.source_path).not.toBe(privatePath);
  // The blind relay holds ciphertext, never source code or record content.
  const dump =
    [...peer.documents.values()]
      .flat()
      .map((update) => Buffer.from(update.payload, "base64").toString())
      .join("") +
    [...peer.states.values()].map((state) => Buffer.from(state.payload, "base64").toString()).join("") +
    [...peer.blobs.values()]
      .flatMap((blob) => [...blob.parts.values()])
      .map((bytes) => Buffer.from(bytes).toString())
      .join("");
  expect(dump).not.toContain("published second revision");
  expect(dump).not.toContain("shared record from private code");
  // Failed set activation retains the previous installed source.
  await writeFile(join(source, "extension.ts"), 'throw new Error("cannot activate"); export default {};');
  const bad = await apps[1]!.deps.assetTransferService.stage(
    publishedOwner(projectId),
    crypto.randomUUID(),
    await packExtension(source),
  );
  const current = await sourceFor(1);
  await expect(
    activatePublishedSet(apps[1]!.deps, projectId, [
      { publication: { ...publicationSchema.parse((await read(1)).value), revision: bad.sha256 }, asset: bad },
    ]),
  ).rejects.toThrow("cannot activate");
  expect((await sourceFor(1)).installedSource.id).toBe(current.installedSource.id);
});

test("a synced set that fails to activate keeps the current set and waits until the set changes", async () => {
  const c = apps[2]!;
  const before = await sourceFor(2);
  const broken = createTestExtensionSource({
    root,
    installName: "broken-unrelated",
    name: "unrelated",
    displayName: "Unrelated",
    version: "1.0.0",
  });
  await writeFile(join(broken, "extension.ts"), 'throw new Error("cannot activate"); export default {};');
  const bad = await c.deps.assetTransferService.stage(
    publishedOwner(projectId),
    crypto.randomUUID(),
    await packExtension(broken),
  );
  // Catch up first, so this selection is newer than every other device's and wins the merge.
  await sync(2);
  const catalog = await catalogFor(2);
  await catalog.select(
    { extensionId: "test.unrelated", revision: bad.sha256, version: "1.0.0", enabled: true },
    bad,
    (await catalog.read("test.unrelated")).revision,
  );
  let attempts = 0;
  const extensionService = {
    ...c.deps.extensionService,
    listProjectExtensionInstances: (id: string) => {
      attempts++;
      return c.deps.extensionService.listProjectExtensionInstances(id);
    },
  };
  let passes = 0;
  const connection = startPublishedExtensions({
    config,
    deps: { ...c.deps, extensionService },
    access,
    relay: projectRelay(config),
    signal: controller.signal,
    statusChanged: () => passes++,
  });
  publications.push(connection);
  const waitFor = async (condition: () => Promise<boolean>) => {
    while (!(await condition())) await Bun.sleep(10);
  };
  await waitFor(async () => (await connection.status()).needsAttention);
  const failedAttempts = attempts;
  for (const _ of [1, 2]) {
    const seen = passes;
    connection.wake();
    await waitFor(async () => passes > seen && !(await connection.status()).busy);
  }
  expect(attempts).toBe(failedAttempts);
  expect((await sourceFor(2)).installedSource.id).toBe(before.installedSource.id);
});

test("retry keeps project files unavailable until the published extension activates", async () => {
  const app = apps[2]!;
  const project = await app.deps.projectService.create({ name: "Activation retry" });
  const release = Promise.withResolvers<void>();
  const retried = Promise.withResolvers<void>();
  const failed = Promise.withResolvers<void>();
  const downloaded = Promise.withResolvers<void>();
  const activated = Promise.withResolvers<void>();
  let attempts = 0;
  const health = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch() {
      if (++attempts === 1) return new Response(null, { status: 503 });
      retried.resolve();
      await release.promise;
      return new Response("ready");
    },
  });
  let connection: ReturnType<typeof startPublishedExtensions> | undefined;
  let syncPeer: ReturnType<typeof documentPeer> | undefined;
  try {
    syncPeer = documentPeer([project.id]);
    const source = createTestExtensionSource({
      root,
      installName: "activation-retry",
      name: "activation-retry",
      displayName: "Activation retry",
    });
    await writeFile(
      join(source, "extension.ts"),
      `
      if (!(await fetch(${JSON.stringify(health.url.href)})).ok) throw new Error("Activation unavailable");
      export default {};
    `,
    );
    const asset = await app.deps.assetTransferService.stage(
      publishedOwner(project.id),
      crypto.randomUUID(),
      await packExtension(source),
    );
    const catalog = await openPublishedCatalog(app.deps, project.id);
    await catalog.select(
      { extensionId: "test.activation-retry", revision: asset.sha256, version: "0.0.0", enabled: true },
      asset,
      (await catalog.read("test.activation-retry")).revision,
    );
    const projectConfig = {
      ...config,
      workbenchId: project.id,
      managerOrigin: syncPeer.origin,
      relayOrigin: syncPeer.origin,
    };
    connection = startPublishedExtensions({
      config: projectConfig,
      deps: app.deps,
      access,
      relay: projectRelay(projectConfig),
      signal: controller.signal,
      statusChanged: () => {
        void connection
          ?.status()
          .then((status) => {
            if (status.needsAttention) failed.resolve();
            // Document progress is announced before the published set finishes activating.
            else if (projectSyncStatus([status]).state === "synced") activated.resolve();
            if (status.needsAttention && status.downloaded) downloaded.resolve();
          })
          .catch(failed.reject);
      },
    });
    await failed.promise;
    connection.wake();
    await downloaded.promise;
    expect((await connection.status()).downloaded).toBe(true);
    connection.retry();
    await retried.promise;
    const pending = await connection.status();
    expect(pending.needsAttention).toBe(true);
    expect(projectSyncStatus([pending]).offlineReady).toBe(false);
    expect(await app.deps.extensionService.listProjectExtensionInstances(project.id)).toHaveLength(0);
    release.resolve();
    await activated.promise;
    expect(projectSyncStatus([await connection.status()]).offlineReady).toBe(true);
    expect(await app.deps.extensionService.listProjectExtensionInstances(project.id)).toHaveLength(1);
  } finally {
    release.resolve();
    connection?.close();
    await connection?.done;
    await syncPeer?.close();
    await health.stop(true);
  }
});
