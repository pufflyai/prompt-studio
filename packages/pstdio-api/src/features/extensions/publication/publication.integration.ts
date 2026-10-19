import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RelayAdapter } from "pstdio-sync";
import { createConformanceServices } from "pstdio-sync-contracts/conformance";
import { createTestApp } from "../../../test-utils/create-test-app";
import { loadExtensionSource } from "../extension-runtime";
import { createTestExtensionSource } from "../test-utils/create-test-extension-source";
import { activatePublication } from "./activate";
import { openPublishedCatalog, publicationSchema, publishExtension, publishedOwner } from "./catalog";

const services = await createConformanceServices(
  process.env.SYNC_TEST_DATABASE_URL!,
  process.env.SYNC_TEST_OBJECT_ENDPOINT!,
);
const root = await mkdtemp(join(tmpdir(), "publication-integration-"));
const apps: Awaited<ReturnType<typeof createTestApp>>[] = [];
const projectId = crypto.randomUUID();
const scope = { ...publishedOwner(projectId), accountId: "owner" };
beforeAll(async () => {
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  for (let index = 0; index < 3; index++) {
    const app = await createTestApp({ storageRoot: join(root, String(index)) });
    apps.push(app);
    await app.deps.projectService.create({ id: projectId, name: "Shared workbench" });
  }
});
afterAll(async () => {
  await Promise.all(apps.map((app) => app.close()));
  await services.close();
  await rm(root, { recursive: true, force: true });
});
const adapter: RelayAdapter = {
  scope,
  snapshot: () => services.relay.snapshot(scope),
  submit: (mutation) => services.relay.submit(mutation),
  assets: {
    put: async (asset, source) =>
      services.objects.put(scope, asset, new Uint8Array(await new Response(await source()).arrayBuffer())),
    get: async (asset, offset) => {
      const bytes = await services.objects.get(scope, asset);
      return bytes ? new Blob([bytes.slice(offset)]).stream() : null;
    },
  },
};
const sourceFor = async (index: number) =>
  (await apps[index]!.deps.extensionService.listProjectExtensionInstances(projectId))[0]!;
const activate = async (index: number) => {
  const catalog = await openPublishedCatalog(apps[index]!.deps, projectId);
  for (const record of Object.values((await catalog.readState()).accepted?.records ?? {}))
    if (record.asset)
      await activatePublication(apps[index]!.deps, projectId, publicationSchema.parse(record.value), record.asset);
};

test("three environments receive exact packages, resume interrupted catch-up, retain competing publications and roll back", async () => {
  const [a, b, c] = apps;
  const source = createTestExtensionSource({
    root,
    installName: "unrelated",
    name: "unrelated",
    displayName: "Unrelated",
  });
  await writeFile(join(source, "payload.bin"), new Uint8Array([0, 255, 23]));
  const loaded = await loadExtensionSource(source);
  const enabled = await a!.deps.extensionService.enableInstalledSourceForProject({
    projectId,
    sourcePath: source,
    extensionId: loaded.metadata.id,
    installName: "unrelated",
    name: "unrelated",
    displayName: "Unrelated",
    manifest: loaded.manifest,
  });
  const catalogs = await Promise.all(apps.map((app) => openPublishedCatalog(app.deps, projectId)));
  const read = (index: number) => catalogs[index]!.records.read(loaded.metadata.id);
  await publishExtension(a!.deps, {
    projectId,
    instanceId: enabled.instance.id,
    expectedRevision: (await read(0)).revision,
  });
  await catalogs[0]!.synchronize(adapter);
  const first = await read(0);
  for (const index of [1, 2]) {
    await catalogs[index]!.synchronize(adapter);
    await activate(index);
    const installed = await sourceFor(index);
    expect(installed.installedSource.source_ref).toBe(`pstdio-published:${first.asset!.sha256}`);
    expect(await readFile(join(installed.installedSource.source_path, "payload.bin"))).toEqual(
      Buffer.from([0, 255, 23]),
    );
  }
  const privatePath = (await sourceFor(2)).installedSource.source_path;
  await writeFile(join(privatePath, "private.txt"), "private local draft");
  expect((await read(2)).asset).toEqual(first.asset);
  await writeFile(join(source, "a.txt"), "publication A");
  await writeFile(join((await sourceFor(1)).installedSource.source_path, "b.txt"), "competing publication B");
  await publishExtension(a!.deps, {
    projectId,
    instanceId: enabled.instance.id,
    expectedRevision: (await read(0)).revision,
  });
  await publishExtension(b!.deps, {
    projectId,
    instanceId: (await sourceFor(1)).instance.id,
    expectedRevision: (await read(1)).revision,
  });
  await catalogs[0]!.synchronize(adapter);
  const second = await read(0);
  const bytes = (await services.objects.get(scope, second.asset!))!;
  await services.objects.remove(scope, second.asset!);
  await expect(catalogs[2]!.synchronize(adapter)).rejects.toThrow();
  expect((await catalogs[2]!.readState()).accepted?.records[loaded.metadata.id].asset).toEqual(first.asset);
  expect((await sourceFor(2)).installedSource.source_path).toBe(privatePath);
  await services.objects.put(scope, second.asset!, bytes);
  const offsets: number[] = [];
  let interrupted = false;
  const interruptedAdapter: RelayAdapter = {
    ...adapter,
    assets: {
      ...adapter.assets!,
      get: async (asset, offset) => {
        if (asset.sha256 !== second.asset!.sha256) return adapter.assets!.get(asset, offset);
        offsets.push(offset);
        if (interrupted) return new Blob([bytes.slice(offset)]).stream();
        interrupted = true;
        let sent = false;
        return new ReadableStream({
          pull(controller) {
            if (!sent) {
              sent = true;
              controller.enqueue(bytes.slice(0, Math.floor(bytes.length / 2)));
            } else controller.error(new Error("download interrupted"));
          },
        });
      },
    },
  };
  await expect(catalogs[2]!.synchronize(interruptedAdapter)).rejects.toThrow("download interrupted");
  await catalogs[2]!.synchronize(interruptedAdapter);
  expect(offsets[0]).toBe(0);
  expect(offsets[1]).toBeGreaterThan(0);
  await activate(2);
  expect((await sourceFor(2)).installedSource.source_path).toBe(privatePath);
  expect((await catalogs[1]!.synchronize(adapter)).status).toBe("conflict");
  expect((await catalogs[1]!.records.conflicts()).length).toBe(1);
  expect((await read(1)).asset).toEqual(second.asset);
  await activatePublication(c!.deps, projectId, publicationSchema.parse(second.value), second.asset!, undefined, true);
  expect((await sourceFor(2)).installedSource.source_ref).toBe(`pstdio-published:${second.asset!.sha256}`);
  expect(await readFile(join(privatePath, "private.txt"), "utf8")).toBe("private local draft");
  await catalogs[0]!.records.commit({
    operationId: crypto.randomUUID(),
    edits: [
      { recordId: loaded.metadata.id, expectedRevision: second.revision, replace: first.value!, asset: first.asset },
    ],
  });
  await catalogs[0]!.synchronize(adapter);
  await catalogs[2]!.synchronize(adapter);
  await activate(2);
  expect((await sourceFor(2)).installedSource.source_ref).toBe(`pstdio-published:${first.asset!.sha256}`);
});
