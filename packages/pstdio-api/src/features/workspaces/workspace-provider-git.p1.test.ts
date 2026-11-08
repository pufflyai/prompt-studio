import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { reconcileProviderWorkspaces } from "./workspace-provider-reconciliation";
import { deleteProviderBackedWorkspace } from "./workspace-provider-lifecycle";
import { resolveWorkspaceExecutionTarget } from "./workspace-provider-execution-target";

let root: string;
let projectId: string;
let sourceFolder: string;
let handle: Awaited<ReturnType<typeof createTestApp>>;
let previous: { home?: string; defaults?: string };
const post = (path: string, data: unknown) => handle.app.request(path, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data),
});
const git = async (...args: string[]) => {
  const child = Bun.spawn(["git", ...args], { cwd: sourceFolder, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  if (code) throw new Error(stderr);
  return stdout.trim();
};
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
  await writeFile(join(sourceFolder, "README.md"), "Original project\n");
  await git("add", ".");
  await git("commit", "-m", "Initial project");
  handle = await openApp();
  const created = await post("/v1/projects", { name: "Git provider", initial_workspace: { provider_id: "pstdio.root", params: { path: sourceFolder } } });
  expect(created.status).toBe(201);
  projectId = (await created.json()).id;
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
  const providers = async () => (await (await handle.app.request(`/v1/projects/${projectId}/workspace-providers`)).json());
  expect(await providers()).toEqual([]);
  const extensionPath = new URL("../../../../../extensions/git-workspaces/", import.meta.url).pathname;
  const manifest = JSON.parse(await readFile(join(extensionPath, "package.json"), "utf8"));
  const enabled = await post(`/v1/projects/${projectId}/extensions/installed/git-workspaces/enable`, {
    name: "git-workspaces", displayName: "Git workspaces", extensionId: "pstdio.git-workspaces", manifest,
    sourcePath: extensionPath, sourceHash: null, sourceKind: "local_path", sourceRef: null, version: manifest.version,
  });
  expect(enabled.status).toBe(200);
  expect(await providers()).toMatchObject([{ id: "pstdio.worktree", params: { base: { defaultValue: "main" } } }]);
  const created = await post("/v1/workspaces", { project_id: projectId, provider_id: "pstdio.worktree", params: { base: "HEAD" } });
  expect(created.status).toBe(201);
  const workspace = await created.json();
  expect(workspace).toMatchObject({ provider_state: "ready", execution_kind: "local", provider_error_json: null });
  expect(await readFile(join(workspace.root_path, "README.md"), "utf8")).toBe("Original project\n");
  const ref = workspace.provider_ref_json;
  const { base: _base, branch: _branch, ...legacyData } = ref.data;
  await handle.deps.workspaceService.updateProviderProjection(workspace.id, { provider_ref_json: { version: 1, data: { providerId: "pstdio.worktree", ...legacyData } } });
  await handle.close();
  handle = await openApp();
  await reconcileProviderWorkspaces(handle.deps, projectId, { workspaceId: workspace.id });
  const reopened = await handle.deps.workspaceService.get(workspace.id);
  expect(reopened).toMatchObject({ id: workspace.id, root_path: workspace.root_path, branch: workspace.branch, provider_state: "ready" });
  const [{ instance }] = await handle.deps.extensionService.listProjectExtensionInstances(projectId);
  const toggle = async (enabled: boolean) => handle.app.request(`/v1/projects/${projectId}/extensions/${instance!.id}`, {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled }),
  });
  expect((await toggle(false)).status).toBe(200);
  expect(await handle.deps.workspaceService.get(workspace.id)).toMatchObject({ provider_state: "provider_missing", root_path: workspace.root_path, branch: workspace.branch });
  expect(await resolveWorkspaceExecutionTarget(handle.deps, workspace.id)).toBeUndefined();
  expect(existsSync(join(workspace.root_path, "README.md"))).toBe(true);
  expect((await toggle(true)).status).toBe(200);
  expect(await handle.deps.workspaceService.get(workspace.id)).toMatchObject({ provider_state: "ready", root_path: workspace.root_path, branch: workspace.branch });
  await deleteProviderBackedWorkspace(handle.deps, reopened!);
  expect(existsSync(workspace.root_path)).toBe(false);
  expect(existsSync(sourceFolder)).toBe(true);
  expect(await git("branch", "--list", workspace.branch)).toBe("");
});
