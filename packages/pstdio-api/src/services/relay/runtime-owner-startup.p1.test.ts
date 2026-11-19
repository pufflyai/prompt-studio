import { expect, spyOn, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadExtensionSource } from "../../features/extensions/extension-runtime";
import { documentPeer } from "../../features/extensions/publication/document-peer.fixture";
import { createTestExtensionSource } from "../../features/extensions/test-utils/create-test-extension-source";
import { initializeProjectWorkspace } from "../../features/projects/project-folder";
import { createTestApp } from "../../test-utils/create-test-app";
import * as extensionOwner from "./extension-owner";
import { startRelayRuntime } from "./runtime";

test("a blocked extension start does not hold up another extension's Cloud saves", async () => {
  const root = await mkdtemp(join(tmpdir(), "cloud-owner-startup-"));
  const app = await createTestApp({ storageRoot: join(root, "home") });
  const peer = documentPeer();
  const releaseFolder = Promise.withResolvers<void>();
  const folderRequested = Promise.withResolvers<void>();
  let runtime: Awaited<ReturnType<typeof startRelayRuntime>> | undefined;
  let updating: Promise<void> | undefined;
  const startExtension = extensionOwner.startRelayExtension;
  let start: ReturnType<typeof spyOn<typeof extensionOwner, "startRelayExtension">> | undefined;
  let blocked = false;
  try {
    const project = await app.deps.projectService.create({ name: "Independent downloads" });
    const folder = join(root, "checkout");
    await mkdir(folder);
    await initializeProjectWorkspace(
      app.deps,
      project.id,
      { provider_id: "pstdio.root", params: { path: folder } },
      async () => [],
    );
    for (const name of ["slow-notes", "independent-notes"]) {
      const path = createTestExtensionSource({ root, installName: name, name, displayName: name });
      const source = await loadExtensionSource(path);
      await app.deps.extensionService.enableInstalledSourceForProject({
        projectId: project.id,
        sourcePath: path,
        extensionId: source.metadata.id,
        installName: name,
        name,
        displayName: name,
        manifest: source.manifest,
        version: "0.0.0",
      });
    }
    const snapshot = await app.deps.extensionRuntimeCatalog.get(project.id);
    expect(snapshot.enabledSources).toHaveLength(2);
    const slow = snapshot.enabledSources[1]!.installedSource.extension_id;
    const independent = snapshot.enabledSources[0]!.installedSource.extension_id;
    const environmentId = (await app.deps.environmentService.get()).environmentId;
    const prior = await app.deps.accountService.status();
    app.deps.accountService.status = async () => ({
      ...prior,
      login: { accountId: "owner", deviceId: environmentId, managerOrigin: peer.origin, relayOrigin: peer.origin },
      cloudProjects: [project.id],
      cloudProjectsLoaded: true,
    });
    app.deps.accountService.devices = async () => [];
    const { records } = await app.deps.extensionStorageService.open({
      owner: { workbenchId: project.id, extensionId: independent },
    });
    await records.commit({ operationId: "independent", edits: [{ recordId: "note", replace: "Saved independently" }] });
    expect((await records.outcome("independent"))?.state).toBe("saved-locally");
    // Exercise discovery order changing after the earlier catalog read.
    const getCatalog = app.deps.extensionRuntimeCatalog.get.bind(app.deps.extensionRuntimeCatalog);
    app.deps.extensionRuntimeCatalog.get = async (...args) => {
      const current = await getCatalog(...args);
      return { ...current, enabledSources: [...current.enabledSources].reverse() };
    };
    runtime = await startRelayRuntime({ deps: app.deps });
    start = spyOn(extensionOwner, "startRelayExtension").mockImplementation(async (input) => {
      // Delay one identified owner at its entry, before its folder preparation.
      // Counting shared workspace lookups can instead delay the independent owner.
      if (input.source.installedSource.extension_id === slow) {
        blocked = true;
        folderRequested.resolve();
        await releaseFolder.promise;
        blocked = false;
      }
      return startExtension(input);
    });
    updating = runtime.update([
      {
        accountId: "owner",
        workbenchId: project.id,
        environmentId,
        managerOrigin: peer.origin,
        relayOrigin: peer.origin,
        renewalGrant: "fixture",
      },
    ]);
    await folderRequested.promise;
    const end = Date.now() + 3000;
    while ((await records.outcome("independent"))?.state !== "synced" && Date.now() < end) await Bun.sleep(10);
    expect((await records.outcome("independent"))?.state).toBe("synced");
    expect(blocked).toBe(true);
  } finally {
    releaseFolder.resolve();
    start?.mockRestore();
    await updating;
    await runtime?.close();
    await app.close();
    await peer.close();
    await rm(root, { recursive: true, force: true });
  }
});
