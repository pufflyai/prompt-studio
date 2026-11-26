import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { packExtension, type RegistryRelease } from "pstdio-extensions/distribution";
import { installExtensionSource, toExtensionEnableInput } from "../features/extensions/install-extension-source";
import { expectRejection } from "../test-utils/expect-rejection";
import { createExtensionUpgradeService, type ExtensionService } from "./extension-upgrade-service";
import { createRegistryExtensionSource, type RegistryUpgradeSource } from "./registry-extension-source";

const [apiMajor, apiMinor] = EXTENSION_API_VERSION.split(".").map(Number);
const hostApi = `^${EXTENSION_API_VERSION}`;
const nextApi = `^${apiMajor}.${apiMinor + 1}.0`;
const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "registry-upgrade-"));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const source = join(root, "source");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(source));
  const packages = new Map<string, Uint8Array>();
  const releases: RegistryRelease[] = [];
  const publish = async (version: string, enginesPstdio = hostApi, broken = false) => {
    await writeFile(
      join(source, "package.json"),
      JSON.stringify({
        name: "notes",
        publisher: "pstdio",
        version,
        engines: { pstdio: enginesPstdio },
        main: "extension.ts",
      }),
    );
    await writeFile(
      join(source, "extension.ts"),
      broken
        ? 'throw new Error("Activation failed");'
        : `export default {commands:[{id:"version",ref:{kind:"command",id:"version"},title:"Version",cli:true,run(){return "${version}"}}]};`,
    );
    const packed = await packExtension(source);
    packages.set(version, packed.bytes);
    const release = { id: "pstdio.notes", version, enginesPstdio, sha256: packed.sha256, withdrawn: false };
    releases.push(release);
    return release;
  };
  const requests: string[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) => {
      const path = new URL(request.url).pathname;
      requests.push(path);
      if (path === "/api/pstdio/notes/versions") return Response.json({ versions: releases });
      const version = /^\/api\/pstdio\/notes\/([^/]+)\/file$/.exec(path)?.[1];
      const bytes = version ? packages.get(version) : null;
      return bytes ? new Response(new Uint8Array(bytes)) : new Response("Not found", { status: 404 });
    },
  });
  cleanups.push(() => server.stop(true));
  const registry = createRegistryExtensionSource(
    {
      release: { source: "registry", ref: `psx:${server.url.origin}` },
    },
    installExtensionSource,
  );
  const entry = {
    installName: "notes",
    extensionId: "pstdio.notes",
    displayName: "Notes",
    description: "",
    default: false,
    origin: { kind: "git" as const, url: "https://example.com/repo", path: "extensions/notes", ref: "{hostRelease}" },
  };
  const options = { env: { PSTDIO_HOME: join(root, "host") }, skipInstall: true, installName: "notes", force: true };
  const first = async () => {
    await publish("0.45.1");
    const installed = await registry.installCatalog(entry, options);
    return { installed, recorded: { source_kind: "registry", source_ref: installed.source.ref!, version: "0.45.1" } };
  };
  const upgrade = async (recorded: RegistryUpgradeSource) => {
    const old = {
      ...recorded,
      install_name: "notes",
      extension_id: "pstdio.notes",
      source_path: join(root, "host", "extensions", "notes"),
    };
    const service = createExtensionUpgradeService({
      release: { source: "registry", ref: `psx:${server.url.origin}` },
      workspaceService: { getDefault: async () => null },
      extensionService: {
        getProjectExtensionInstance: async () => ({ instance: { id: "test-instance" }, installedSource: old }),
        assertInstalledSourceChoice: async () => {},
        registerInstalledSource: async (source: Parameters<ExtensionService["registerInstalledSource"]>[0]) => ({
          ...old,
          version: source.version,
          source_path: source.sourcePath,
          source_ref: source.sourceRef,
        }),
      } as unknown as ExtensionService,
      installExtensionSource: (input) => installExtensionSource({ ...input, ...options, retainBackup: false }),
    });
    return (await service.upgrade("test-project", "test-instance"))!.installedSource;
  };
  return { root, registry, options, first, publish, server, requests, upgrade };
};

test("upgrades the extension on an unchanged host to its newest compatible release", async () => {
  const f = await fixture();
  const { installed, recorded } = await f.first();
  expect(toExtensionEnableInput(installed).sourceKind).toBe("registry");
  await f.publish("0.45.2");
  await f.publish("0.46.0", nextApi);
  expect(await f.registry.canUpgrade(recorded)).toBe(true);
  f.requests.length = 0;
  const upgraded = await f.upgrade(recorded);
  expect(f.requests).toEqual(["/api/pstdio/notes/versions", "/api/pstdio/notes/0.45.2/file"]);
  expect(upgraded.version).toBe("0.45.2");
  expect(await readFile(join(upgraded.source_path, "extension.ts"), "utf8")).toContain('return "0.45.2"');
});
test("refuses a modified download and preserves the working files", async () => {
  const f = await fixture();
  const { installed, recorded } = await f.first();
  const before = await readFile(join(installed.targetPath, "extension.ts"), "utf8");
  const release = await f.publish("0.45.2");
  release.sha256 = "0".repeat(64);
  await expectRejection(f.upgrade(recorded)).toThrow("SHA-256");
  expect(await readFile(join(installed.targetPath, "extension.ts"), "utf8")).toBe(before);
});
test("keeps the installed extension when the candidate cannot load or the registry is unavailable", async () => {
  const f = await fixture();
  const { installed, recorded } = await f.first();
  const before = await readFile(join(installed.targetPath, "extension.ts"), "utf8");
  await f.publish("0.45.2", hostApi, true);
  await expectRejection(f.upgrade(recorded)).toThrow();
  expect(await readFile(join(installed.targetPath, "extension.ts"), "utf8")).toBe(before);
  await f.server.stop(true);
  await expectRejection(f.upgrade(recorded)).toThrow("unreachable");
  expect(await readFile(join(installed.targetPath, "extension.ts"), "utf8")).toBe(before);
});
