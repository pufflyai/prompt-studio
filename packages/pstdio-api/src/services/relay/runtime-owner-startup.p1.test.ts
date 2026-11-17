import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadExtensionSource } from "../../features/extensions/extension-runtime";
import { documentPeer } from "../../features/extensions/publication/document-peer.fixture";
import { createTestExtensionSource } from "../../features/extensions/test-utils/create-test-extension-source";
import { initializeProjectWorkspace } from "../../features/projects/project-folder";
import { createTestApp } from "../../test-utils/create-test-app";
import { startRelayRuntime } from "./runtime";

test("an extension waiting for its folder does not hold up another extension's Cloud saves", async () => {
  const root = await mkdtemp(join(tmpdir(), "cloud-owner-startup-"));
  const app = await createTestApp({ storageRoot: join(root, "home") });
  const peer = documentPeer();
  const releaseFolder = Promise.withResolvers<void>();
  const folderRequested = Promise.withResolvers<void>();
  let runtime: Awaited<ReturnType<typeof startRelayRuntime>> | undefined;
  let updating: Promise<void> | undefined;
  const getDefault = app.deps.workspaceService.getDefault;
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
    const independent = snapshot.enabledSources[1]!.installedSource.extension_id;
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
    runtime = await startRelayRuntime({ deps: app.deps });
    let lookups = 0;
    app.deps.workspaceService.getDefault = async (...args) => {
      // The first lookup captures the shared context; the next belongs to the first owner's folder.
      if (++lookups === 2) {
        folderRequested.resolve();
        await releaseFolder.promise;
      }
      return getDefault(...args);
    };
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
  } finally {
    releaseFolder.resolve();
    app.deps.workspaceService.getDefault = getDefault;
    await updating;
    await runtime?.close();
    await app.close();
    await peer.close();
    await rm(root, { recursive: true, force: true });
  }
});
