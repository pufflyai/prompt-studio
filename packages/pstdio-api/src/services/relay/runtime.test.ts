import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../test-utils/create-test-app";
import { folderProjectInput } from "../../test-utils/folder-project-input";
import { discoveryPeer } from "./discovery-peer.fixture";
import { startRelayRuntime } from "./runtime";

const waitFor = async (condition: () => boolean) => {
  const deadline = Date.now() + 2000;
  while (!condition() && Date.now() < deadline) await Bun.sleep(10);
  expect(condition()).toBe(true);
};

test("a cloud project syncs all enabled extensions and follows enable, disable, and source changes", async () => {
  const root = await mkdtemp(join(tmpdir(), "relay-discovery-"));
  const previous = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  const home = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const app = await createTestApp();
  const wire = discoveryPeer("account");
  let runtime: Awaited<ReturnType<typeof startRelayRuntime>> | undefined;
  const enable = async (name: string, targetProject = projectId) => {
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
    const response = await app.app.request(`/v1/projects/${targetProject}/extensions/installed/${name}/enable`, {
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
    const environment = await app.deps.environmentService.get();
    const connection = (workbenchId: string, renewalGrant: string) => ({
      accountId: "account",
      workbenchId,
      environmentId: environment.environmentId,
      relayOrigin: wire.peer.url.origin,
      managerOrigin: wire.peer.url.origin,
      renewalGrant,
    });
    runtime = await startRelayRuntime({ deps: app.deps });
    await runtime.update([connection(projectId, "owned-grant")]);
    await waitFor(() => JSON.stringify(wire.connected()) === JSON.stringify(["example.first"]));
    expect(wire.connected()).toEqual(["example.first"]);
    const additional = await app.app.request("/v1/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(folderProjectInput({ name: "Additional workbench" })),
    });
    expect(additional.status).toBe(201);
    const additionalProject = (await additional.json()) as { id: string };
    await enable("additional", additionalProject.id);
    const existingOpens = wire.opened.filter((id) => id === "example.first").length;
    await runtime.update([
      connection(projectId, "owned-grant"),
      connection(additionalProject.id, "second-owned-grant"),
    ]);
    await waitFor(() => wire.connected().length === 2);
    expect(wire.connected()).toEqual(["example.additional", "example.first"]);
    expect(wire.opened.filter((id) => id === "example.first")).toHaveLength(existingOpens);
    await enable("second");
    await waitFor(() => wire.connected().length === 3);
    expect(wire.connected()).toEqual(["example.additional", "example.first", "example.second"]);
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
    await waitFor(() => JSON.stringify(wire.connected()) === JSON.stringify(["example.additional", "example.second"]));
    expect(wire.connected()).toEqual(["example.additional", "example.second"]);
    const openStorage = app.deps.extensionStorageService.open;
    const starting = Promise.withResolvers<void>();
    const resume = Promise.withResolvers<void>();
    let pauseNextStart = true;
    app.deps.extensionStorageService.open = async (input) => {
      if (pauseNextStart && input.owner.workbenchId === projectId) {
        pauseNextStart = false;
        starting.resolve();
        await resume.promise;
      }
      return openStorage(input);
    };
    try {
      app.deps.extensionRuntimeCatalog.invalidate({ projectId, reason: "source_changed" });
      await starting.promise;
      const rotated = runtime.update([
        connection(projectId, "renewed-grant"),
        connection(additionalProject.id, "second-owned-grant"),
      ]);
      resume.resolve();
      await rotated;
      await waitFor(() => wire.renewals.includes("Bearer renewed-grant"));
      expect(wire.renewals).toContain("Bearer renewed-grant");
      await runtime.update([connection(projectId, "renewed-grant")]);
      await waitFor(() => JSON.stringify(wire.connected()) === JSON.stringify(["example.second"]));
      await runtime.update([]);
      await waitFor(() => wire.connected().length === 0);
    } finally {
      resume.resolve();
      app.deps.extensionStorageService.open = openStorage;
    }
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
