import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { automationsId, publishedExtensionsId } from "pstdio-sync-contracts";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";
import { discoveryPeer } from "./discovery-peer.fixture";
import { startRelayRuntime } from "./runtime";

const waitFor = async (condition: () => boolean) => {
  const deadline = Date.now() + 2000;
  while (!condition() && Date.now() < deadline) await Bun.sleep(10);
  expect(condition()).toBe(true);
};

test("workbench enrollment discovers all enabled extensions and follows enable, disable, and source changes", async () => {
  const root = await mkdtemp(join(tmpdir(), "relay-discovery-"));
  const previous = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  const home = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const app = await createTestApp();
  const wire = discoveryPeer("account");
  let runtime: Awaited<ReturnType<typeof startRelayRuntime>> | undefined;
  const enable = async (name: string) => {
    const source = join(root, name);
    await mkdir(source, { recursive: true });
    await writeFile(
      join(source, "package.json"),
      JSON.stringify({
        name,
        publisher: "example",
        version: "1.0.0",
        main: "extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      }),
    );
    await writeFile(join(source, "extension.ts"), "export default {commands:[]};");
    const response = await app.app.request(`/v1/projects/${projectId}/extensions/installed/${name}/enable`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        extensionId: `example.${name}`,
        name,
        sourcePath: source,
        sourceKind: "local_path",
        displayName: name,
        sourceHash: null,
        sourceRef: null,
        version: null,
        manifest: { id: `example.${name}`, name },
      }),
    });
    expect(response.status).toBe(200);
    return (await response.json()) as { instanceId: string };
  };
  const projectResponse = await app.app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(folderProjectInput({ name: "Discovery" })),
  });
  expect(projectResponse.status).toBe(201);
  const { id: projectId } = (await projectResponse.json()) as { id: string };
  try {
    const first = await enable("first");
    const installed = (await app.deps.extensionService.listProjectExtensionInstances(projectId))[0]!.installedSource;
    await app.deps.installedExtensionSourcesService.updateRegistration(installed.id, {
      source_ref: `pstdio-published:${"a".repeat(64)}`,
      loaded_revision: "webview-build-generation",
    });
    const environment = await app.deps.environmentService.get();
    const path = join(root, "relay.json");
    await writeFile(
      path,
      JSON.stringify({
        connections: [
          {
            accountId: "account",
            workbenchId: projectId,
            environmentId: environment.environmentId,
            relayOrigin: wire.peer.url.origin,
            managerOrigin: wire.peer.url.origin,
            renewalGrant: "owned-grant",
          },
        ],
      }),
    );
    runtime = await startRelayRuntime({ path, environment: app.deps.environmentService, deps: app.deps });
    await waitFor(
      () =>
        JSON.stringify(wire.connected()) === JSON.stringify(["example.first", automationsId, publishedExtensionsId]),
    );
    expect(wire.connected()).toEqual(["example.first", automationsId, publishedExtensionsId]);
    expect(wire.snapshots.get(JSON.stringify([projectId, "example.first"]))?.publishedRevision).toBe("a".repeat(64));
    await enable("second");
    await waitFor(() => wire.connected().length === 4);
    expect(wire.connected()).toEqual(["example.first", "example.second", automationsId, publishedExtensionsId]);
    const before = wire.opened.length;
    app.deps.extensionRuntimeCatalog.invalidate({ projectId, reason: "source_changed" });
    await waitFor(() => wire.opened.length > before);
    expect(wire.opened.length).toBeGreaterThan(before);
    await app.app.request(`/v1/projects/${projectId}/extensions/${first.instanceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    });
    app.deps.extensionRuntimeCatalog.invalidate({ projectId, reason: "enablement_changed" });
    await waitFor(
      () =>
        JSON.stringify(wire.connected()) === JSON.stringify(["example.second", automationsId, publishedExtensionsId]),
    );
    expect(wire.connected()).toEqual(["example.second", automationsId, publishedExtensionsId]);
  } finally {
    await runtime?.close();
    await wire.peer.stop(true);
    await app.close();
    await rm(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    else process.env.PSTDIO_DEFAULT_EXTENSIONS = previous;
    if (home === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = home;
  }
});
