import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createTestApp } from "../../test-utils/create-test-app";
import { enableGitWorkspaceProvider } from "../../test-utils/git-workspace-provider.fixture";
import { createProjectExtensionLifecycle } from "../extensions/project-extension-lifecycle";
import { resolveWorkspaceExecutionTarget } from "./workspace-provider-execution-target";
import { deleteProviderBackedWorkspace } from "./workspace-provider-lifecycle";
import { reconcileProviderWorkspaces } from "./workspace-provider-reconciliation";

let root: string;
let projectId: string;
let sourceFolder: string;
let handle: Awaited<ReturnType<typeof createTestApp>>;
let previous: { home?: string; defaults?: string };
const post = (path: string, data: unknown) =>
  handle.app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
const git = async (...args: string[]) => {
  const child = Bun.spawn(["git", ...args], { cwd: sourceFolder, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code) throw new Error(stderr);
  return stdout.trim();
};
const shellQuote = (text: string) => `'${text.replaceAll("'", "'\\''")}'`;
const openApp = () => createTestApp({ databasePath: join(root, "database"), storageRoot: join(root, "storage") });
beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "installed-git-provider-")));
  previous = { home: process.env.PSTDIO_HOME, defaults: process.env.PSTDIO_DEFAULT_EXTENSIONS };
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  sourceFolder = join(root, "project");
  await mkdir(sourceFolder);
  await git("init", "-b", "main");
  await git("config", "user.email", "fixture@example.test");
  await git("config", "user.name", "Fixture");
  await git("config", "core.autocrlf", "false");
  await writeFile(join(sourceFolder, "README.md"), "Original project\n");
  await git("add", ".");
  await git("commit", "-m", "Initial project");
  handle = await openApp();
  const created = await post("/v1/projects", {
    name: "Git provider",
    initial_workspace: { provider_id: "pstdio.root", params: { path: sourceFolder } },
  });
  expect(created.status).toBe(201);
  projectId = (await created.json()).id;
});

test("a real checkout hook cannot grant execution outside the provider-owned directory", async () => {
  const folder = join(sourceFolder, "docs");
  await mkdir(folder);
  await writeFile(join(folder, "notes.txt"), "Nested project\n");
  await git("add", "docs");
  await git("commit", "-m", "Add nested project");
  const outside = join(root, "outside");
  await mkdir(outside);
  await writeFile(join(outside, "notes.txt"), "Outside files\n");
  const hook = join(sourceFolder, ".git", "hooks", "post-checkout");
  const hookSource = `const { rmSync, symlinkSync } = require("node:fs"); rmSync("docs", { recursive: true, force: true }); symlinkSync(${JSON.stringify(outside)}, "docs", ${JSON.stringify(process.platform === "win32" ? "junction" : "dir")});`;
  await writeFile(
    hook,
    `#!/bin/sh\n${shellQuote(process.execPath.replaceAll("\\", "/"))} -e ${shellQuote(hookSource)}\n`,
  );
  await chmod(hook, 0o755);
  try {
    const project = await post("/v1/projects", {
      name: "Nested Git project",
      initial_workspace: { provider_id: "pstdio.root", params: { path: folder } },
    });
    expect(project.status).toBe(201);
    const { id } = await project.json();
    await enableGitWorkspaceProvider(handle, id);
    const created = await post("/v1/workspaces", {
      project_id: id,
      provider_id: "pstdio.worktree",
      params: { base: "HEAD" },
    });
    expect(created.status).toBe(202);
    const workspace = await created.json();
    expect(workspace).toMatchObject({ provider_state: "failed", provider_error_json: { retryable: true } });
    expect(await realpath(join(workspace.provider_ref_json.data.worktreeRoot, "docs"))).toBe(outside);
    expect(await resolveWorkspaceExecutionTarget(handle.deps, workspace.id)).toBeUndefined();
    expect(existsSync(join(outside, ".pstdio"))).toBe(false);
    await deleteProviderBackedWorkspace(handle.deps, workspace);
    expect(await readFile(join(outside, "notes.txt"), "utf8")).toBe("Outside files\n");
    expect(existsSync(workspace.provider_ref_json.data.worktreeRoot)).toBe(false);
  } finally {
    await rm(hook, { force: true });
  }
});
afterAll(async () => {
  await handle?.close();
  if (previous.home === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previous.home;
  if (previous.defaults === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
  else process.env.PSTDIO_DEFAULT_EXTENSIONS = previous.defaults;
  await rm(root, { recursive: true, force: true });
});

test("installed Git lifecycle uses the public provider for existing IDs and preserves checkout identity across restart", async () => {
  const providers = async () =>
    await (await handle.app.request(`/v1/projects/${projectId}/workspace-providers`)).json();
  expect(await providers()).toEqual([]);
  const extensionPath = fileURLToPath(new URL("../../../../../extensions/git-workspaces/", import.meta.url));
  const manifest = JSON.parse(await readFile(join(extensionPath, "package.json"), "utf8"));
  const enabled = await post(`/v1/projects/${projectId}/extensions/installed/git-workspaces/enable`, {
    name: "git-workspaces",
    displayName: "Git workspaces",
    extensionId: "pstdio.git-workspaces",
    manifest,
    sourcePath: extensionPath,
    sourceHash: null,
    sourceKind: "local_path",
    sourceRef: null,
    version: manifest.version,
  });
  expect(enabled.status).toBe(200);
  expect(await providers()).toMatchObject([{ id: "pstdio.worktree", params: { base: { defaultValue: "main" } } }]);
  const created = await post("/v1/workspaces", {
    project_id: projectId,
    provider_id: "pstdio.worktree",
    params: { base: "HEAD" },
  });
  expect(created.status).toBe(201);
  const workspace = await created.json();
  expect(workspace).toMatchObject({ provider_state: "ready", execution_kind: "local", provider_error_json: null });
  expect(await readFile(join(workspace.root_path, "README.md"), "utf8")).toBe("Original project\n");
  const ref = workspace.provider_ref_json;
  const { base: _base, branch: _branch, ...legacyData } = ref.data;
  await handle.deps.workspaceService.updateProviderProjection(workspace.id, {
    provider_ref_json: { version: 1, data: { providerId: "pstdio.worktree", ...legacyData } },
  });
  await handle.close();
  handle = await openApp();
  await reconcileProviderWorkspaces(handle.deps, projectId, { workspaceId: workspace.id });
  const reopened = await handle.deps.workspaceService.get(workspace.id);
  expect(reopened).toMatchObject({
    id: workspace.id,
    root_path: workspace.root_path,
    branch: workspace.branch,
    provider_state: "ready",
  });
  const [{ instance }] = await handle.deps.extensionService.listProjectExtensionInstances(projectId);
  await expect(
    createProjectExtensionLifecycle(handle.deps).uninstall({
      projectId,
      instanceId: instance!.id,
      deleteUserData: true,
    }),
  ).rejects.toThrow("provider-backed workspace");
  const toggle = async (enabled: boolean) =>
    handle.app.request(`/v1/projects/${projectId}/extensions/${instance!.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
  expect((await toggle(false)).status).toBe(200);
  expect(await handle.deps.workspaceService.get(workspace.id)).toMatchObject({
    provider_state: "provider_missing",
    root_path: workspace.root_path,
    branch: workspace.branch,
  });
  expect(await resolveWorkspaceExecutionTarget(handle.deps, workspace.id)).toBeUndefined();
  expect(existsSync(join(workspace.root_path, "README.md"))).toBe(true);
  expect((await toggle(true)).status).toBe(200);
  expect(await handle.deps.workspaceService.get(workspace.id)).toMatchObject({
    provider_state: "ready",
    root_path: workspace.root_path,
    branch: workspace.branch,
  });
  await deleteProviderBackedWorkspace(handle.deps, reopened!);
  expect(existsSync(workspace.root_path)).toBe(false);
  expect(existsSync(sourceFolder)).toBe(true);
  expect(await git("branch", "--list", workspace.branch)).toBe("");
});
