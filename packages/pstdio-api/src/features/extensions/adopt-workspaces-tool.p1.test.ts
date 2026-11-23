import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canRefreshWorkspacesTool, refreshingWorkspacesEntry } from "../../startup/workspaces-tool-upgrade";
import { createTestApp } from "../../test-utils/create-test-app";
import { adoptWorkspacesTool, combinedWorkspacesSource } from "./adopt-workspaces-tool";
import { installDefaultExtensions, registerInstalledExtensionSources } from "./default-extensions";
import { hashExtensionSourceAsync } from "./extension-runtime";
import { syncInstalledExtensionsForProject } from "./installed-extension-sync";
import { openPublishedCatalog, publishExtension, publishedOwner } from "./publication/catalog";
import { packExtension } from "./publication/package";

let root: string;
let handle: Awaited<ReturnType<typeof createTestApp>>;
let previous: { home?: string; defaults?: string };
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "combined-workspaces-"));
  previous = { home: process.env.PSTDIO_HOME, defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS };
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  await mkdir(join(process.env.PSTDIO_HOME, "extensions"), { recursive: true });
  handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage") });
});
afterAll(async () => {
  await handle.close();
  for (const [key, value] of [
    ["PSTDIO_HOME", previous.home],
    ["PSTDIO_DEFAULT_EXTENSIONS", previous.defaults],
  ])
    if (value === undefined) delete process.env[key!];
    else process.env[key!] = value;
  await rm(root, { recursive: true, force: true });
});

const source = async (name: string, installName = name) => {
  const path = join(process.env.PSTDIO_HOME!, "extensions", installName);
  await mkdir(path, { recursive: true });
  const manifest = {
    name,
    publisher: "pstdio",
    version: "0.1.0",
    main: "./extension.ts",
    engines: { pstdio: "^0.5.0" },
  };
  await writeFile(join(path, "package.json"), JSON.stringify(manifest));
  await writeFile(
    join(path, "extension.ts"),
    'export default { workspaceTypes: [{ id: "git", ref: { kind: "workspace-type", id: "git" }, label: "Git worktree", create() { throw new Error("unused"); }, resolve() { throw new Error("unused"); } }] };',
  );
  return { path, manifest };
};

const enableSource = async (projectId: string, installName: string, item: Awaited<ReturnType<typeof source>>) =>
  handle.deps.extensionService.enableInstalledSourceForProject({
    projectId,
    installName,
    name: item.manifest.name,
    displayName: installName,
    extensionId: `pstdio.${item.manifest.name}`,
    manifest: item.manifest,
    sourcePath: item.path,
    sourceHash: null,
    sourceKind: "local_path",
    sourceRef: null,
    version: "0.1.0",
  });

test("enabled Git Workspaces becomes one enabled, shared Workspaces tool and retains its source files", async () => {
  const project = await handle.deps.projectService.create({ name: "Migration" });
  const legacy = await source("git-workspaces");
  const combined = await source("workspaces");
  const enable = async (name: string, item: Awaited<ReturnType<typeof source>>) =>
    handle.deps.extensionService.enableInstalledSourceForProject({
      projectId: project.id,
      installName: name,
      name,
      displayName: name,
      extensionId: `pstdio.${name}`,
      manifest: item.manifest,
      sourcePath: item.path,
      sourceHash: null,
      sourceKind: "local_path",
      sourceRef: null,
      version: "0.1.0",
    });
  const old = await enable("git-workspaces", legacy);
  const replacement = await enable("workspaces", combined);
  await handle.deps.extensionService.setProjectExtensionEnabled(replacement.instance.id, false);
  const catalog = await openPublishedCatalog(handle.deps, project.id);
  await publishExtension(handle.deps, {
    projectId: project.id,
    instanceId: old.instance.id,
    expectedRevision: (await catalog.read("pstdio.git-workspaces")).revision,
  });
  await adoptWorkspacesTool(handle.deps, project.id, [
    { path: combined.path, hash: await hashExtensionSourceAsync(combined.path) },
  ]);
  expect((await catalog.list()).map(({ recordId, value }) => ({ id: recordId, enabled: value?.enabled }))).toEqual([
    { id: "pstdio.workspaces", enabled: true },
  ]);
  expect(
    (await handle.deps.extensionService.listProjectExtensionInstances(project.id)).map(
      ({ instance, installedSource }) => ({ id: installedSource.extension_id, enabled: instance.enabled }),
    ),
  ).toEqual([{ id: "pstdio.workspaces", enabled: true }]);
  expect(existsSync(join(legacy.path, "extension.ts"))).toBe(true);
  await syncInstalledExtensionsForProject({ extensionService: handle.deps.extensionService, projectId: project.id });
  expect(
    (await handle.deps.extensionService.listProjectExtensionInstances(project.id)).map(
      ({ installedSource }) => installedSource.extension_id,
    ),
  ).toEqual(["pstdio.workspaces"]);
  expect(await readFile(join(legacy.path, "package.json"), "utf8")).toContain("git-workspaces");
});

test("consolidation preserves the selected private Workspaces copy and does not publish its private files", async () => {
  const project = await handle.deps.projectService.create({ name: "Private workspace tool" });
  const legacy = await source("git-workspaces");
  const combined = await source("workspaces");
  const privateCopy = await source("workspaces", "private-workspaces");
  await writeFile(join(privateCopy.path, "private-marker.txt"), "Keep this copy private");
  const old = await enableSource(project.id, "git-workspaces", legacy);
  const global = await enableSource(project.id, "workspaces", combined);
  const selected = await enableSource(project.id, "private-workspaces", privateCopy);
  const catalog = await openPublishedCatalog(handle.deps, project.id);
  await publishExtension(handle.deps, {
    projectId: project.id,
    instanceId: old.instance.id,
    expectedRevision: (await catalog.read("pstdio.git-workspaces")).revision,
  });
  await adoptWorkspacesTool(handle.deps, project.id, [
    { path: combined.path, hash: await hashExtensionSourceAsync(combined.path) },
  ]);
  const instances = await handle.deps.extensionService.listProjectExtensionInstances(project.id);
  expect(instances.find(({ instance }) => instance.enabled)?.instance.id).toBe(selected.instance.id);
  expect(instances.find(({ instance }) => instance.id === global.instance.id)?.instance.enabled).toBe(false);
  const shared = await catalog.read("pstdio.workspaces");
  expect(shared.value).toMatchObject({ enabled: true });
  const bytes = await new Response(
    await handle.deps.assetTransferService.read(publishedOwner(project.id), shared.asset!),
  ).text();
  expect(bytes).not.toContain("private-marker.txt");
  expect((await catalog.read("pstdio.git-workspaces")).value).toBeNull();
  expect(await readFile(join(privateCopy.path, "private-marker.txt"), "utf8")).toBe("Keep this copy private");
});

test("an in-place private Workspaces edit never becomes a new shared package", async () => {
  const project = await handle.deps.projectService.create({ name: "Edited default" });
  const legacy = await source("git-workspaces");
  const combined = await source("workspaces");
  const old = await enableSource(project.id, "git-workspaces", legacy);
  await enableSource(project.id, "workspaces", combined);
  const catalog = await openPublishedCatalog(handle.deps, project.id);
  await publishExtension(handle.deps, {
    projectId: project.id,
    instanceId: old.instance.id,
    expectedRevision: (await catalog.read("pstdio.git-workspaces")).revision,
  });
  const accepted = { path: combined.path, hash: await hashExtensionSourceAsync(combined.path) };
  await writeFile(join(combined.path, "private-marker.txt"), "Private edit");
  await adoptWorkspacesTool(handle.deps, project.id, [accepted]);
  expect((await catalog.read("pstdio.workspaces")).value).toBeNull();
  expect((await catalog.read("pstdio.git-workspaces")).value).not.toBeNull();
  expect(await handle.deps.extensionService.getProjectExtensionInstance(project.id, old.instance.id)).not.toBeNull();
  expect(await readFile(join(combined.path, "private-marker.txt"), "utf8")).toBe("Private edit");
});

test("an unchanged older Workspaces installation upgrades before the shared Git provider is retired", async () => {
  const project = await handle.deps.projectService.create({ name: "Old workspace browser" });
  const legacy = await source("git-workspaces");
  const oldBrowser = await source("workspaces");
  await writeFile(join(oldBrowser.path, "extension.ts"), "export default {};\n");
  const old = await enableSource(project.id, "git-workspaces", legacy);
  const browser = await enableSource(project.id, "workspaces", oldBrowser);
  const catalog = await openPublishedCatalog(handle.deps, project.id);
  for (const [id, instanceId] of [
    ["pstdio.git-workspaces", old.instance.id],
    ["pstdio.workspaces", browser.instance.id],
  ])
    await publishExtension(handle.deps, {
      projectId: project.id,
      instanceId: instanceId!,
      expectedRevision: (await catalog.read(id!)).revision,
    });
  const originalBytes = await packExtension(oldBrowser.path);
  expect(await canRefreshWorkspacesTool(browser.installedSource)).toBe(false);
  const installedSource = {
    ...browser.installedSource,
    source_kind: "git" as const,
    source_ref:
      "https://github.com/pufflyai/prompt-studio@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa#extensions/pstdio-workspaces",
  };
  const readManagedSource = async () => originalBytes;
  expect(await canRefreshWorkspacesTool(installedSource, readManagedSource)).toBe(true);
  expect(
    await canRefreshWorkspacesTool(installedSource, async () => {
      throw new Error("offline");
    }),
  ).toBe(false);
  await writeFile(join(oldBrowser.path, ".env"), "PRIVATE=keep");
  expect(await canRefreshWorkspacesTool(installedSource, readManagedSource)).toBe(false);
  await rm(join(oldBrowser.path, ".env"));
  await writeFile(join(oldBrowser.path, "private-edit.txt"), "Keep private");
  expect(await canRefreshWorkspacesTool(installedSource, readManagedSource)).toBe(false);
  await rm(join(oldBrowser.path, "private-edit.txt"));
  const combined = await source("workspaces", "next-workspaces");
  const installed = await installDefaultExtensions({
    config: {
      defaultExtensions: [
        refreshingWorkspacesEntry({ source: combined.path, installName: "workspaces", skipInstall: true }),
      ],
    },
    registerInstalledSources: (items) => registerInstalledExtensionSources(handle.deps.extensionService, items),
  });
  expect(installed).toHaveLength(1);
  expect(await combinedWorkspacesSource(oldBrowser.path)).toBe(true);
  await adoptWorkspacesTool(
    handle.deps,
    project.id,
    installed.map(({ targetPath, sourceHash }) => ({ path: targetPath, hash: sourceHash })),
  );
  expect((await catalog.read("pstdio.git-workspaces")).value).toBeNull();
  expect((await catalog.read("pstdio.workspaces")).value).toMatchObject({ enabled: true });
  expect(await handle.deps.extensionService.getProjectExtensionInstance(project.id, old.instance.id)).toBeNull();
});

test("an unavailable shared successor keeps the legacy fallback and private files until its package can be verified", async () => {
  const project = await handle.deps.projectService.create({ name: "Unavailable shared tool" });
  const legacy = await source("git-workspaces");
  const combined = await source("workspaces");
  const old = await enableSource(project.id, "git-workspaces", legacy);
  const next = await enableSource(project.id, "workspaces", combined);
  const catalog = await openPublishedCatalog(handle.deps, project.id);
  for (const [id, instanceId] of [
    ["pstdio.git-workspaces", old.instance.id],
    ["pstdio.workspaces", next.instance.id],
  ])
    await publishExtension(handle.deps, {
      projectId: project.id,
      instanceId: instanceId!,
      expectedRevision: (await catalog.read(id!)).revision,
    });
  const shared = await catalog.read("pstdio.workspaces");
  await writeFile(join(combined.path, "private-marker.txt"), "Keep private");
  const read = handle.deps.assetTransferService.read;
  const unavailable = {
    ...handle.deps,
    assetTransferService: {
      ...handle.deps.assetTransferService,
      read: async (...args: Parameters<typeof read>) => {
        if (args[1].sha256 === shared.asset!.sha256) throw new Error("package not downloaded");
        return read(...args);
      },
    },
  };
  expect(await adoptWorkspacesTool(unavailable, project.id)).toBeUndefined();
  expect((await catalog.read("pstdio.git-workspaces")).value).not.toBeNull();
  await adoptWorkspacesTool(handle.deps, project.id);
  expect((await catalog.read("pstdio.git-workspaces")).value).toBeNull();
  expect((await catalog.read("pstdio.workspaces")).asset).toEqual(shared.asset);
  expect(await readFile(join(combined.path, "private-marker.txt"), "utf8")).toBe("Keep private");
});

test("a different publisher named workspaces cannot shadow the first-party successor", async () => {
  const project = await handle.deps.projectService.create({ name: "Qualified successor" });
  const combined = await source("workspaces");
  const privatePath = join(root, "repo", "workspaces");
  await mkdir(privatePath, { recursive: true });
  const manifest = { ...combined.manifest, publisher: "acme" };
  await writeFile(join(privatePath, "package.json"), JSON.stringify(manifest));
  await writeFile(join(privatePath, "extension.ts"), await readFile(join(combined.path, "extension.ts")));
  await writeFile(join(privatePath, "private.txt"), "Acme customization");
  const acme = await handle.deps.extensionService.enableInstalledSourceForProject({
    projectId: project.id,
    installName: "workspaces",
    name: "workspaces",
    displayName: "Acme Workspaces",
    extensionId: "acme.workspaces",
    manifest,
    sourcePath: privatePath,
    sourceKind: "local_path",
    sourceHash: null,
    sourceRef: null,
    version: "0.1.0",
  });
  const legacy = await source("git-workspaces");
  const old = await enableSource(project.id, "git-workspaces", legacy);
  const successor = await enableSource(project.id, "workspaces", combined);
  await handle.deps.extensionService.setProjectExtensionEnabled(successor.instance.id, false);
  const catalog = await openPublishedCatalog(handle.deps, project.id);
  await publishExtension(handle.deps, {
    projectId: project.id,
    instanceId: old.instance.id,
    expectedRevision: (await catalog.read("pstdio.git-workspaces")).revision,
  });
  await adoptWorkspacesTool(handle.deps, project.id, [
    { path: combined.path, hash: await hashExtensionSourceAsync(combined.path) },
  ]);
  expect((await catalog.read("pstdio.git-workspaces")).value).toBeNull();
  expect((await catalog.read("pstdio.workspaces")).value).toMatchObject({ enabled: true });
  expect(
    (await handle.deps.extensionService.getProjectExtensionInstance(project.id, acme.instance.id))?.instance.enabled,
  ).toBe(true);
  expect(await readFile(join(privatePath, "private.txt"), "utf8")).toBe("Acme customization");
});
