import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import type { InstallExtensionResponse, UpgradeProjectExtensionResponse } from "pstdio-api-contracts";
import type { PreparedExtensionRevision } from "pstdio-extensions";
import { packExtension, packExtensionReleaseBundle } from "pstdio-extensions/distribution";
import { revisionDigest } from "pstdio-extensions/prepared-cache";
import { folderProjectInput } from "../helpers/folder-project";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";
import { writeRegistryNotes } from "./registry-notes.fixture";
import { startRegistryService } from "./registry-service.fixture";
import { startRegistryWireFixture } from "./registry-wire.fixture";

const expectAcceptedPrebuiltRevision = async (home: string, sourcePath: string) => {
  // Read the published marker for this installed source while the host prepares revisions in parallel.
  const marker = `${revisionDigest(resolve(sourcePath))}.json`;
  const revision: PreparedExtensionRevision = await Bun.file(
    join(home, "cache", "extension-revisions", "accepted", marker),
  ).json();
  expect(revision.prebuiltRelease).toBe(true);
  expect(basename(revision.entryPath)).toBe(".pstdio-release-runtime.mjs");
  expect(await Bun.file(revision.entryPath).exists()).toBe(true);
  return revision;
};

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
    const unavailable = await post(`${project}/install`, { source: { kind: "catalog", name: "pstdio.artifacts" } });
    expect(unavailable.status).toBe(400);
    expect(await unavailable.json()).toMatchObject({ error: expect.any(String) });
    const installed = await post(`${project}/install`, { source: { kind: "catalog", name: "pstdio.notes" } });
    expect(installed.status).toBe(201);
    const { extension } = (await installed.json()) as InstallExtensionResponse;
    const measure = async (version: string, prebuilt: boolean) => {
      await publish(version, prebuilt);
      const started = performance.now();
      const upgraded = await post(`${project}/${extension.id}/upgrade`);
      expect(upgraded.status).toBe(200);
      const { extension: upgradedExtension } = (await upgraded.json()) as UpgradeProjectExtensionResponse;
      expect(upgradedExtension.version).toBe(version);
      const command = await post(`${project}/commands/pstdio.notes.command.version/execute`, {});
      expect(command.status).toBe(200);
      expect(await command.json()).toMatchObject({ outcome: { ok: true, value: version } });
      return { durationMs: Math.round(performance.now() - started), sourcePath: upgradedExtension.sourcePath };
    };
    const sourceUpgrade = await measure("0.45.2", false);
    const bundleUpgrade = await measure("0.45.3", true);
    await expectAcceptedPrebuiltRevision(home, bundleUpgrade.sourcePath);
    console.log(
      JSON.stringify({
        case: "packaged-upgrade-to-first-command",
        sourceMs: sourceUpgrade.durationMs,
        bundleMs: bundleUpgrade.durationMs,
      }),
    );
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
    const { source: installedSource } = (await installed.json()) as InstallExtensionResponse;
    const command = await fetch(`${project}/commands/pstdio.planner.command.list-tickets/execute`, {
      method: "POST",
      headers,
      body: "{}",
    });
    expect(command.status).toBe(200);
    expect(await command.json()).toMatchObject({ outcome: { ok: true } });
    const revision = await expectAcceptedPrebuiltRevision(home, installedSource.targetPath);
    const compiledViews = Object.values(revision.webviews ?? {});
    expect(compiledViews.length).toBeGreaterThan(0);
    for (const view of compiledViews) expect(await Bun.file(join(view.distDir, "module.js")).exists()).toBe(true);
  } finally {
    if (host) await stopProcess(host.child);
    await rm(root, { recursive: true, force: true });
  }
});
