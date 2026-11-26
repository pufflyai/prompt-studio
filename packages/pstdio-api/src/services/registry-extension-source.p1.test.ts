import { afterEach, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { packExtension, packExtensionReleaseBundle, type RegistryRelease } from "pstdio-extensions/distribution";
import { runExtensionPreparation } from "../features/extensions/extension-preparation";
import { fingerprintUpgradeWorkingTree } from "../features/extensions/extension-upgrade-working-tree";
import { installExtensionSource, toExtensionEnableInput } from "../features/extensions/install-extension-source";
import { createTestHarnessRegistry } from "../features/harnesses/test-harness-registry";
import { createTestApp } from "../test-utils/create-test-app";
import { expectRejection } from "../test-utils/expect-rejection";
import { folderProjectInput } from "../test-utils/folder-project-input";
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
  await mkdir(source);
  const packages = new Map<string, Uint8Array>();
  const releases: RegistryRelease[] = [];
  const bundles = new Map<string, Uint8Array>();
  const publish = async (version: string, enginesPstdio = hostApi, broken = false, prebuilt = false) => {
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
    const release: RegistryRelease = {
      id: "pstdio.notes",
      version,
      enginesPstdio,
      sha256: packed.sha256,
      withdrawn: false,
    };
    if (prebuilt) {
      const bundle = await packExtensionReleaseBundle(
        { extensionId: release.id, version, sourceSha256: packed.sha256, webviews: [] },
        { "runtime.mjs": await readFile(join(source, "extension.ts")) },
      );
      release.bundles = [bundle.descriptor];
      bundles.set(bundle.descriptor.sha256, bundle.bytes);
    }
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
      const bundleId = /\/bundles\/([a-f0-9]{64})$/.exec(path)?.[1];
      if (bundleId) {
        const bytes = bundles.get(bundleId);
        return bytes ? new Response(new Uint8Array(bytes)) : new Response("Not found", { status: 404 });
      }
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
  const upgradeService = (recorded: RegistryUpgradeSource) => {
    const old = {
      ...recorded,
      install_name: "notes",
      extension_id: "pstdio.notes",
      source_path: join(root, "host", "extensions", "notes"),
      // Model a Reload that adopted the current disk contents.
      source_hash: fingerprintUpgradeWorkingTree(join(root, "host", "extensions", "notes")),
    };
    return createExtensionUpgradeService({
      home: options.env.PSTDIO_HOME,
      release: { source: "registry", ref: `psx:${server.url.origin}` },
      workspaceService: { getDefault: async () => null },
      extensionService: {
        getProjectExtensionInstance: async () => ({ instance: { id: "test-instance" }, installedSource: old }),
        registerInstalledSource: async (source: Parameters<ExtensionService["registerInstalledSource"]>[0]) => ({
          ...old,
          version: source.version,
          source_path: source.sourcePath,
          source_ref: source.sourceRef,
        }),
      } as unknown as ExtensionService,
      installExtensionSource: (input) =>
        installExtensionSource({
          ...options,
          ...input,
          retainBackup: input.installName?.startsWith("review-validation-") ?? false,
        }),
    });
  };
  const upgrade = async (recorded: RegistryUpgradeSource) =>
    (await upgradeService(recorded).upgrade("test-project", "test-instance"))!.installedSource;
  return { root, registry, options, first, publish, server, requests, upgrade, upgradeService };
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

test("preserves local edits even after they are reflected in the installed source record", async () => {
  const f = await fixture();
  const { installed, recorded } = await f.first();
  const file = join(installed.targetPath, "extension.ts");
  const edited = "export default {}; // local edit";
  await writeFile(file, edited);
  await f.publish("0.45.2");
  f.requests.length = 0;

  await expectRejection(f.upgrade(recorded)).toThrow("has local changes");
  expect(f.requests).toEqual(["/api/pstdio/notes/versions"]);
  expect(await readFile(file, "utf8")).toBe(edited);
});

test("recovers a missing baseline from the exact version recorded at install", async () => {
  const f = await fixture();
  const { recorded } = await f.first();
  await rm(join(f.root, "host", "cache", "extension-upgrade-baselines"), { recursive: true, force: true });
  await f.publish("0.45.2");
  f.requests.length = 0;

  const upgraded = await f.upgrade(recorded);
  expect(upgraded.version).toBe("0.45.2");
  expect(f.requests.filter((path) => path.endsWith("/file"))).toEqual([
    "/api/pstdio/notes/0.45.1/file",
    "/api/pstdio/notes/0.45.2/file",
  ]);
});

test("upgrades with a verified release bundle and leaves the matching editable source installed", async () => {
  const f = await fixture();
  const { recorded } = await f.first();
  const release = await f.publish("0.45.2", hostApi, false, true);
  f.requests.length = 0;

  const upgraded = await f.upgrade(recorded);
  expect(upgraded.version).toBe("0.45.2");
  expect(f.requests).toContain(`/api/pstdio/notes/0.45.2/bundles/${release.bundles![0]!.sha256}`);
  expect(await readFile(join(upgraded.source_path, "extension.ts"), "utf8")).toContain('return "0.45.2"');
  const cache = join(f.root, "host", "cache", "extension-revisions", "revisions");
  const bundledRuntimes = [...new Bun.Glob("**/.pstdio-release-runtime.mjs").scanSync(cache)];
  expect(bundledRuntimes).toHaveLength(1);
});

test("reviews an overlapping edit against the original release and applies user-approved text", async () => {
  const f = await fixture();
  const { installed, recorded } = await f.first();
  const path = join(installed.targetPath, "extension.ts");
  const original = await readFile(path, "utf8");
  const local = original.replace('title:"Version"', 'title:"My version command"');
  await writeFile(path, local);
  await writeFile(join(installed.targetPath, "local-notes.txt"), "local notes");
  await f.publish("0.45.2");
  const service = f.upgradeService(recorded);
  const { reviews } = service;
  const review = (await reviews.beginReview("test-project", "test-instance"))!;
  expect(review.hasOriginal).toBe(true);
  expect(review.changes).toContainEqual({
    path: "extension.ts",
    status: "conflict",
    localKind: "file",
    incomingKind: "file",
  });
  expect(await reviews.readReview("a-different-project", "test-instance", review.id)).toBeNull();
  const difference = (await reviews.readReviewFile("test-project", "test-instance", review.id, "extension.ts"))!;
  expect(difference.base).toBe(original);
  expect(difference.local).toBe(local);
  expect(difference.incoming).toContain('return "0.45.2"');
  await expectRejection(
    reviews.applyReview("test-project", "test-instance", review.id, [], { revision: review.revision }),
  ).toThrow("Resolve every conflict");
  expect(await readFile(path, "utf8")).toBe(local);
  const text = difference.incoming!.replace('title:"Version"', 'title:"My version command"');
  const choices = [{ path: "extension.ts", kind: "text" as const, text }];
  const saved = (await reviews.saveReview("test-project", "test-instance", review.id, review.revision, choices))!;
  const resumed = await f.upgradeService(recorded).reviews.beginReview("test-project", "test-instance");
  expect(resumed).toMatchObject({ id: saved.id, revision: saved.revision, resolutions: choices });
  await expectRejection(reviews.saveReview("test-project", "test-instance", review.id, review.revision, [])).toThrow(
    "Another view saved resolutions",
  );
  await expectRejection(
    reviews.applyReview("test-project", "test-instance", review.id, choices, { revision: review.revision }),
  ).toThrow("Another view saved resolutions");

  await writeFile(path, `${local}\n// A later edit`);
  await expect(
    reviews.applyReview("test-project", "test-instance", review.id, choices, { revision: saved.revision }),
  ).rejects.toMatchObject({ changedPaths: ["extension.ts"] });
  expect(await readFile(path, "utf8")).toContain("A later edit");
  expect(await reviews.beginReview("test-project", "test-instance")).toMatchObject({
    id: review.id,
    revision: saved.revision,
    resolutions: choices,
    changedPaths: ["extension.ts"],
  });
  await writeFile(path, local);
  expect(await reviews.validateReview("test-project", "test-instance", review.id, saved.revision, choices)).toEqual({
    valid: true,
    revision: saved.revision,
  });
  expect(await readFile(path, "utf8")).toBe(local);
  const applied = await reviews.applyReview("test-project", "test-instance", review.id, choices, {
    revision: saved.revision,
  });
  expect(applied?.installedSource.version).toBe("0.45.2");
  expect(await reviews.readReview("test-project", "test-instance", review.id)).toBeNull();
  expect(await readFile(path, "utf8")).toBe(text);
  expect(await readFile(join(installed.targetPath, "local-notes.txt"), "utf8")).toBe("local notes");
  await f.publish("0.45.3");
  await expectRejection(
    f.upgrade({
      source_kind: "registry",
      source_ref: applied!.installedSource.source_ref,
      version: "0.45.2",
    }),
  ).toThrow("local changes");
  expect(await readFile(path, "utf8")).toBe(text);
});

test("prefetches source and runtime without installing, then reuses the exact verified pair", async () => {
  const f = await fixture();
  const { installed, recorded } = await f.first();
  const release = await f.publish("0.45.2", hostApi, false, true);
  await runExtensionPreparation(
    "release.prefetch",
    { url: f.server.url.origin, id: release.id, release },
    { home: f.options.env.PSTDIO_HOME, priority: "background" },
  );
  expect(await readFile(join(installed.targetPath, "extension.ts"), "utf8")).toContain('return "0.45.1"');
  f.requests.length = 0;
  const upgraded = await f.upgrade(recorded);
  expect(upgraded.version).toBe("0.45.2");
  expect(f.requests).toEqual(["/api/pstdio/notes/versions"]);
  expect(await readFile(join(upgraded.source_path, "extension.ts"), "utf8")).toContain('return "0.45.2"');
});

test("switches one project to a separate published provider and preserves the local folder and its other users", async () => {
  const f = await fixture();
  const { installed } = await f.first();
  await f.publish("0.45.2");
  const localPath = join(f.root, "edited-local");
  await cp(installed.targetPath, localPath, { recursive: true });
  await mkdir(join(localPath, ".git"));
  const localNote = join(localPath, "notes.txt");
  await writeFile(localNote, "local only");
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = f.options.env.PSTDIO_HOME;
  cleanups.push(async () => {
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
  });
  const handle = await createTestApp({
    storageRoot: join(f.root, "storage"),
    release: { source: "registry", ref: `psx:${f.server.url.origin}` },
    harnessRegistry: createTestHarnessRegistry([]),
  });
  cleanups.push(handle.close);
  const post = (path: string, input: unknown) =>
    handle.app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  const create = async (name: string) => {
    const response = await post("/v1/projects", folderProjectInput({ name }));
    expect(response.status).toBe(201);
    return ((await response.json()) as { id: string }).id;
  };
  const primary = await create("primary");
  const secondary = await create("secondary");
  const service = handle.deps.extensionService;
  const register = async (projectId: string) =>
    service.enableInstalledSourceForProject({
      ...toExtensionEnableInput(installed),
      projectId,
      installName: "edited-local",
      sourceKind: "local_path",
      sourcePath: localPath,
      sourceRef: null,
      preparedRevision: undefined,
    });
  const local = await register(primary);
  const other = await register(secondary);
  const reviewPath = `/v1/projects/${primary}/extensions/${local.instance.id}/upgrade-review`;
  const prepared = await post(reviewPath, { action: "begin" });
  expect(prepared.status).toBe(200);
  const { review } = (await prepared.json()) as {
    review: {
      id: string;
      revision: string;
      changes: Array<{ path: string; status: string }>;
      separateLocalProvider: boolean;
    };
  };
  expect(review.separateLocalProvider).toBe(true);
  const anchor = { type: "extension-upgrade-review", id: review.id, extensionId: "pstdio", role: "context" as const };
  await expectRejection(
    handle.deps.sessionService.create({
      project_id: secondary,
      title: "Foreign review",
      agent: "test",
      anchors: [anchor],
    }),
  ).toThrow("Resource belongs to another project");
  const usePublished = {
    action: "apply",
    id: review.id,
    revision: review.revision,
    resolutions: [],
    usePublished: true,
  };
  await writeFile(localNote, "edited during review");
  const stale = await post(reviewPath, usePublished);
  expect(stale.status).toBe(409);
  expect(await stale.json()).toMatchObject({ details: { changedPaths: ["notes.txt"] } });
  expect(await readFile(localNote, "utf8")).toBe("edited during review");
  await writeFile(localNote, "local only");
  const validated = await post(reviewPath, {
    action: "validate",
    id: review.id,
    revision: review.revision,
    resolutions: review.changes
      .filter(({ status }) => status === "conflict")
      .map(({ path }) => ({ path, kind: path === "notes.txt" ? "local" : "incoming" })),
  });
  expect(await validated.json()).toMatchObject({ action: "validate", valid: true });
  expect((await service.getProjectExtensionInstance(primary, local.instance.id))?.instance.enabled).toBe(true);
  expect((await post(reviewPath, { action: "apply", id: review.id, resolutions: [], usePublished: true })).status).toBe(
    400,
  );
  const applied = await post(reviewPath, usePublished);
  expect(await applied.json()).toMatchObject({
    upgrade: { changed: true, extension: { version: "0.45.2", enabled: true } },
  });
  expect((await service.getProjectExtensionInstance(primary, local.instance.id))?.instance.enabled).toBe(false);
  expect((await service.getProjectExtensionInstance(secondary, other.instance.id))?.instance.enabled).toBe(true);
  expect(await readFile(localNote, "utf8")).toBe("local only");
});
