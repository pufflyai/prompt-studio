import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectSyncStatus } from "pstdio-api-contracts";
import { createRecordAssets } from "../../features/extensions/command-environment/record-assets";
import { loadExtensionSource } from "../../features/extensions/extension-runtime";
import { documentPeer } from "../../features/extensions/publication/document-peer.fixture";
import { createTestExtensionSource } from "../../features/extensions/test-utils/create-test-extension-source";
import { initializeProjectWorkspace } from "../../features/projects/project-folder";
import { createTestApp } from "../../test-utils/create-test-app";
import { type RelayWorkbench, startRelayRuntime } from "./runtime";

test("resuming Cloud after local edits replaces every owner of the retired project socket", async () => {
  const root = await mkdtemp(join(tmpdir(), "cloud-resumption-"));
  const apps = await Promise.all([
    createTestApp({ storageRoot: join(root, "first") }),
    createTestApp({ storageRoot: join(root, "second") }),
  ]);
  const peer = documentPeer();
  const owner = { workbenchId: crypto.randomUUID(), extensionId: "test.notes" };
  const runtimes: Awaited<ReturnType<typeof startRelayRuntime>>[] = [];
  const configs: RelayWorkbench[] = [];
  const reachSynced = async () => {
    const end = Date.now() + 3000;
    let statuses: ProjectSyncStatus[] = [];
    const trace: unknown[] = [];
    do {
      statuses = await Promise.all(runtimes.map((runtime) => runtime.status(owner.workbenchId)));
      trace.push({ at: Date.now(), statuses });
      if (statuses.every((status) => status.state === "synced")) {
        console.info("Diagnostic cloud convergence", trace);
        return;
      }
      await Bun.sleep(10);
    } while (Date.now() < end);
    console.info("Diagnostic cloud convergence failed", trace);
    expect(statuses).toMatchObject([{ state: "synced" }, { state: "synced" }]);
  };
  try {
    for (const [index, app] of apps.entries()) {
      await app.deps.projectService.create({ id: owner.workbenchId, name: "Shared notes" });
      const folder = join(root, `checkout-${index}`);
      await mkdir(folder);
      await initializeProjectWorkspace(
        app.deps,
        owner.workbenchId,
        { provider_id: "pstdio.root", params: { path: folder } },
        async () => [],
      );
      const path = createTestExtensionSource({
        root: join(root, `source-${index}`),
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
      configs.push({
        accountId: "owner",
        workbenchId: owner.workbenchId,
        environmentId,
        managerOrigin: peer.origin,
        relayOrigin: peer.origin,
        renewalGrant: "fixture",
      });
      runtimes.push(await startRelayRuntime({ deps: app.deps }));
    }
    const stores = await Promise.all(
      apps.map((app) =>
        app.deps.extensionStorageService.open({
          owner,
          assets: createRecordAssets(app.deps.assetTransferService, owner),
        }),
      ),
    );
    const asset = await apps[0]!.deps.assetTransferService.stage(owner, "asset", new Blob(["Shared artifact"]));
    await stores[0]!.records.commit({
      operationId: "initial",
      edits: [
        { recordId: "note", replace: "before" },
        { recordId: "caption", replace: "before" },
        { recordId: "file", replace: "file", asset },
      ],
    });
    const native = { recordId: "file", documentKey: "a".repeat(64), content: "Shared artifact" };
    await stores[0]!.records.bindText(native);
    await Promise.all(runtimes.map((runtime, index) => runtime.update([configs[index]!])));
    await reachSynced();
    await Promise.all(runtimes.map((runtime) => runtime.update([])));
    await stores[0]!.records.commit({
      operationId: "first-offline",
      edits: [{ recordId: "note", replace: "first offline" }],
    });
    await stores[1]!.records.commit({
      operationId: "second-offline",
      edits: [{ recordId: "caption", replace: "second offline" }],
    });
    await apps[0]!.deps.extensionStorageService
      .openNativeTextDocument({ owner, fileId: native.documentKey })
      .save("First Shared artifact");
    await apps[1]!.deps.extensionStorageService
      .openNativeTextDocument({ owner, fileId: native.documentKey })
      .save("Shared artifact Last");
    await runtimes[0]!.update([configs[0]!]);
    await runtimes[1]!.update([configs[1]!]);
    await reachSynced();
    for (const store of stores) {
      expect((await store.records.read("note")).value).toBe("first offline");
      expect((await store.records.read("caption")).value).toBe("second offline");
    }
    for (const app of apps)
      expect(
        await app.deps.extensionStorageService.openNativeTextDocument({ owner, fileId: native.documentKey }).read(),
      ).toBe("First Shared artifact Last");
  } finally {
    await Promise.all(runtimes.map((runtime) => runtime.close()));
    await Promise.all(apps.map((app) => app.close()));
    await peer.close();
    await rm(root, { recursive: true, force: true });
  }
});
