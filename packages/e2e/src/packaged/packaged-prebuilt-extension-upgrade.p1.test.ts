import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { InstallExtensionResponse, UpgradeProjectExtensionResponse } from "pstdio-api-contracts";
import { packExtension, packExtensionReleaseBundle } from "pstdio-extensions/distribution";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { writeRegistryNotes } from "./registry-notes.fixture";
import { startRegistryService } from "./registry-service.fixture";
import { startRegistryWireFixture } from "./registry-wire.fixture";

test("activates a prebuilt package through the same packaged upgrade API as a source package", async () => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-prebuilt-upgrade-"));
  const home = join(root, "home");
  const source = join(root, "notes");
  const repo = join(root, "project");
  const registry =
    process.env.PSTDIO_PSX_REAL_SERVICE === "1" ? await startRegistryService() : await startRegistryWireFixture();
  let host: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
  try {
    await mkdir(home);
    await mkdir(repo);
    const publish = async (version: string, prebuilt: boolean) => {
      await writeRegistryNotes(source, version);
      const packed = await packExtension(source);
      const path = join(root, packed.filename);
      await Bun.write(path, packed.bytes);
      await registry.publish(path);
      if (!prebuilt) return;
      const runtime = `export default {commands:[{
        id:"version", ref:{kind:"command",id:"version"}, title:"Version",
        run(){return ${JSON.stringify(version)}}
      }]};`;
      const bundle = await packExtensionReleaseBundle(
        { extensionId: packed.manifest.id, version, sourceSha256: packed.sha256, webviews: [] },
        { "runtime.mjs": new TextEncoder().encode(runtime) },
      );
      await registry.publishBundle(version, bundle.bytes);
    };
    await publish("0.45.1", false);
    host = await startPackagedServe(home, { PSTDIO_EXTENSION_RELEASE_REF: `psx:${registry.origin}` });
    const { baseUrl, descriptor } = host;
    const post = (path: string, body?: unknown) =>
      fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { ...runtimeAuthorization(descriptor), "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    const created = await post("/v1/projects", folderProjectInput({ name: "Isolated prebuilt upgrades" }, repo));
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };
    const project = `/v1/projects/${id}/extensions`;
    const installed = await post(`${project}/install`, { source: { kind: "catalog", name: "pstdio.notes" } });
    expect(installed.status).toBe(201);
    const { extension } = (await installed.json()) as InstallExtensionResponse;
    const measure = async (version: string, prebuilt: boolean) => {
      await publish(version, prebuilt);
      const started = performance.now();
      const upgraded = await post(`${project}/${extension.id}/upgrade`);
      expect(upgraded.status).toBe(200);
      expect(((await upgraded.json()) as UpgradeProjectExtensionResponse).extension.version).toBe(version);
      const command = await post(`${project}/commands/pstdio.notes.command.version/execute`, {});
      expect(command.status).toBe(200);
      expect(await command.json()).toMatchObject({ outcome: { ok: true, value: version } });
      return Math.round(performance.now() - started);
    };
    const sourceMs = await measure("0.45.2", false);
    const bundleMs = await measure("0.45.3", true);
    const cache = join(home, "cache", "extension-revisions", "revisions");
    expect([...new Bun.Glob("**/.pstdio-release-runtime.mjs").scanSync(cache)]).toHaveLength(1);
    console.log(JSON.stringify({ case: "packaged-upgrade-to-first-command", sourceMs, bundleMs }));
  } finally {
    if (host) await stopProcess(host.child);
    await registry.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("a packaged Planner install serves its compiled views and runs a real command", async () => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-packaged-planner-runtime-"));
  const home = join(root, "home");
  const folder = join(root, "project");
  let host: Awaited<ReturnType<typeof startPackagedServe>> | undefined;
  try {
    await mkdir(home);
    await mkdir(folder);
    host = await startPackagedServe(home);
    const { baseUrl, descriptor } = host;
    const headers = { ...runtimeAuthorization(descriptor), "content-type": "application/json" };
    const created = await fetch(`${baseUrl}/v1/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify(folderProjectInput({ name: "Bundled Planner" }, folder)),
    });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };
    const project = `${baseUrl}/v1/projects/${id}/extensions`;
    const installed = await fetch(`${project}/install`, {
      method: "POST",
      headers,
      body: JSON.stringify({ source: { kind: "catalog", name: "pstdio.planner" } }),
    });
    if (!installed.ok) throw new Error(`Planner install failed (${installed.status}): ${await installed.text()}`);
    const command = await fetch(`${project}/commands/pstdio.planner.command.list-tickets/execute`, {
      method: "POST",
      headers,
      body: "{}",
    });
    expect(command.status).toBe(200);
    expect(await command.json()).toMatchObject({ outcome: { ok: true } });
    const cache = join(home, "cache", "extension-revisions", "revisions");
    const entries = [...new Bun.Glob("**/.pstdio-release-runtime.mjs").scanSync(cache)];
    expect(entries).toHaveLength(1);
    const compiledViews = [...new Bun.Glob("**/webviews/*/module.js").scanSync(cache)];
    expect(compiledViews.length).toBeGreaterThan(0);
  } finally {
    if (host) await stopProcess(host.child);
    await rm(root, { recursive: true, force: true });
  }
});
