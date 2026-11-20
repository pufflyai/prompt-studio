import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { adoptWorkspacesTool } from "./adopt-workspaces-tool";
import { needsBuiltInGitRecovery } from "./built-in-git-workspaces";
import { syncInstalledExtensionsForProject } from "./installed-extension-sync";
import { openPublishedCatalog, publishedOwner } from "./publication/catalog";
import { packExtension } from "./publication/package";

let root: string;
let handle: Awaited<ReturnType<typeof createTestApp>>;
let sourcePath: string;
let previous: { home?: string; defaults?: string };
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "built-in-git-recovery-"));
  previous = { home: process.env.PSTDIO_HOME, defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS };
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage") });
  sourcePath = join(root, "home", "extensions", "workspaces");
  await mkdir(sourcePath, { recursive: true });
  const manifest = {
    name: "workspaces",
    publisher: "pstdio",
    version: "0.1.0",
    main: "./extension.ts",
    engines: { pstdio: "^0.5.0" },
  };
  await writeFile(join(sourcePath, "package.json"), JSON.stringify(manifest));
  await writeFile(
    join(sourcePath, "extension.ts"),
    'export default { workspaceTypes: [{ id: "git", ref: { kind: "workspace-type", id: "git" }, label: "Git worktree", create() { throw new Error("unused"); }, resolve() { throw new Error("unused"); } }] };',
  );
  await handle.deps.extensionService.registerInstalledSource({
    installName: "workspaces",
    name: "workspaces",
    displayName: "Workspaces",
    extensionId: "pstdio.workspaces",
    manifest,
    sourcePath,
    sourceKind: "local_path",
    sourceHash: null,
  });
});
afterAll(async () => {
  await handle?.close();
  for (const [key, value] of [
    ["PSTDIO_HOME", previous.home],
    ["PSTDIO_DEFAULT_EXTENSIONS", previous.defaults],
  ])
    if (value === undefined) delete process.env[key!];
    else process.env[key!] = value;
  await rm(root, { recursive: true, force: true });
});
const legacyProject = async () => {
  const project = await handle.deps.projectService.create({ name: "Built-in era" });
  const workspace = await handle.deps.workspaceService.create({
    project_id: project.id,
    shorthand_base: "OLD",
    provider_id: "pstdio.worktree",
    branch: "kept-branch",
    provider_state: "provider_missing",
  });
  const reference = { version: 1 as const, data: { old: "reference" } };
  await handle.deps.workspaceService.updateProviderProjection(workspace.id, { provider_ref_json: reference });
  workspace.provider_ref_json = reference;
  return { project, workspace };
};
const copies = (id: string) => handle.deps.extensionService.listProjectExtensionInstances(id);

test("built-in Git checkouts recover a provider without a preceding extension instance or row rewrite", async () => {
  const { project, workspace } = await legacyProject();
  expect(await copies(project.id)).toEqual([]);
  await syncInstalledExtensionsForProject({ extensionService: handle.deps.extensionService, projectId: project.id });
  const discovered = await copies(project.id);
  expect(discovered).toMatchObject([{ instance: { enabled: false } }]);
  expect(await handle.deps.extensionService.hasDefaultSourceChoice(project.id, "pstdio.workspaces")).toBe(false);
  expect(await needsBuiltInGitRecovery(handle.deps, project.id, discovered)).toBe(true);
  await adoptWorkspacesTool(handle.deps, project.id);
  expect(await copies(project.id)).toMatchObject([
    { instance: { enabled: true }, installedSource: { extension_id: "pstdio.workspaces" } },
  ]);
  expect(
    (await handle.deps.extensionRuntimeCatalog.get(project.id)).runtime.workspaceTypes.map(({ id }) => id),
  ).toContain("pstdio.workspaces.workspace-type.git");
  expect(await handle.deps.workspaceService.get(workspace.id)).toMatchObject({
    id: workspace.id,
    branch: workspace.branch,
    root_path: workspace.root_path,
    provider_ref_json: workspace.provider_ref_json,
  });
});

test("a disabled or removed local Workspaces choice is not re-added by built-in recovery", async () => {
  const { project } = await legacyProject();
  await adoptWorkspacesTool(handle.deps, project.id);
  const [{ instance }] = await copies(project.id);
  await handle.deps.extensionService.setProjectExtensionEnabled(instance!.id, false);
  await adoptWorkspacesTool(handle.deps, project.id);
  expect((await copies(project.id))[0]!.instance.enabled).toBe(false);
  await handle.deps.extensionService.removeProjectExtensionInstance(instance!.id);
  await adoptWorkspacesTool(handle.deps, project.id);
  expect((await copies(project.id)).every(({ instance }) => !instance.enabled)).toBe(true);
});

test("shared disabled and removed choices prevent adopting a new local default", async () => {
  const { project } = await legacyProject();
  const catalog = await openPublishedCatalog(handle.deps, project.id);
  const asset = await handle.deps.assetTransferService.stage(
    publishedOwner(project.id),
    crypto.randomUUID(),
    await packExtension(sourcePath),
  );
  await catalog.select(
    { extensionId: "pstdio.workspaces", revision: asset.sha256, version: "0.1.0", enabled: false },
    asset,
    (await catalog.read("pstdio.workspaces")).revision,
  );
  expect(await needsBuiltInGitRecovery(handle.deps, project.id, [])).toBe(false);
  await adoptWorkspacesTool(handle.deps, project.id);
  expect((await copies(project.id)).every(({ instance }) => !instance.enabled)).toBe(true);
  await catalog.change("pstdio.workspaces", undefined, ({ records }) =>
    records.commit({ operationId: crypto.randomUUID(), edits: [{ recordId: "pstdio.workspaces", deleted: true }] }),
  );
  expect(await needsBuiltInGitRecovery(handle.deps, project.id, [])).toBe(false);
  await adoptWorkspacesTool(handle.deps, project.id);
  expect((await copies(project.id)).every(({ instance }) => !instance.enabled)).toBe(true);
});
