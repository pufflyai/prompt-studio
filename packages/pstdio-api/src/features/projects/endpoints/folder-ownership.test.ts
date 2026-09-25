import { afterAll, beforeAll, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../../test-utils/create-test-app";
import { provisionProjectWorkspaces } from "../../workspaces/provision-coordinator";

type Host = Awaited<ReturnType<typeof createTestApp>>;
let root: string;
let first: Host;
let second: Host;
beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "folder-ownership-")));
  first = await createTestApp();
  second = await createTestApp();
});

test("preserves a local provider's binding when its workspace root is a symlink alias", async () => {
  const project = await open(first, await folder("alias-owner-home"));
  const path = await folder("alias-owner-files");
  const alias = join(root, "provider-alias");
  await symlink(path, alias, "junction");
  const workspace = await first.deps.workspaceService.createStandalone({ project_id: project.id, root_path: alias });
  await mkdir(join(path, ".pstdio"), { recursive: true });
  await writeFile(configPath(path), JSON.stringify({ project_id: project.id, workspace_id: workspace.id }));
  const original = await readConfig(path);
  const rejected = await open(first, path);
  expect((await first.deps.workspaceService.getDefault(rejected.id))?.setup_error).toBeTruthy();
  expect(await readConfig(path)).toBe(original);
});
afterAll(async () => {
  await first?.close();
  await second?.close();
  await rm(root, { recursive: true, force: true });
});
const open = async (host: Host, path: string) => {
  const response = await host.app.request("/v1/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ initial_workspace: { provider_id: "pstdio.root", params: { path } } }),
  });
  expect([200, 201]).toContain(response.status);
  return response.json();
};
const folder = async (name: string) => {
  const path = join(root, name);
  await mkdir(path);
  return path;
};
const configPath = (path: string) => join(path, ".pstdio/config.json");
const readConfig = (path: string) => readFile(configPath(path), "utf8");
const removeProject = async (host: Host, id: string) => {
  const response = await host.app.request(`/v1/projects/${id}`, { method: "DELETE" });
  expect(response.status).toBe(204);
};

test("independent hosts preserve folder ownership through failed setup and extension provisioning", async () => {
  const path = await folder("two-hosts");
  const owner = await open(first, path);
  const original = await readConfig(path);
  const blocked = await open(second, path);
  const failed = await second.deps.workspaceService.getDefault(blocked.id);
  expect(failed?.setup_error).toBeTruthy();
  expect(await readConfig(path)).toBe(original);
  await provisionProjectWorkspaces(second.deps, blocked.id);
  expect((await second.deps.workspaceService.getDefault(blocked.id))?.setup_error).toBeTruthy();
  expect(await readConfig(path)).toBe(original);
  await removeProject(first, owner.id);
  const retried = await open(second, path);
  expect(retried.id).toBe(blocked.id);
  expect(await second.deps.workspaceService.getDefault(blocked.id)).toMatchObject({
    id: failed!.id,
    setup_error: null,
    initializing: false,
  });
  expect(JSON.parse(await readConfig(path))).toMatchObject({ project_id: blocked.id, workspace_id: failed!.id });
});

test("deleting a failed foreign-folder project preserves the other host's binding", async () => {
  const path = await folder("foreign-delete");
  await open(first, path);
  const original = await readConfig(path);
  const blocked = await open(second, path);
  await removeProject(second, blocked.id);
  expect(await readConfig(path)).toBe(original);
});

test("reopening repairs a missing binding and reports a conflicting replacement", async () => {
  const path = await folder("reopen-binding");
  const project = await open(first, path);
  const original = await readConfig(path);
  await rm(configPath(path));
  expect((await open(first, path)).id).toBe(project.id);
  expect(await readConfig(path)).toBe(original);
  const foreign = JSON.stringify({ project_id: "another-host", workspace_id: "another-workspace" });
  await writeFile(configPath(path), foreign);
  expect((await open(first, path)).id).toBe(project.id);
  expect((await first.deps.workspaceService.getDefault(project.id))?.setup_error).toBeTruthy();
  expect(await readConfig(path)).toBe(foreign);
});

test("deleting a project releases its binding and preserves user files for reopening", async () => {
  const path = await folder("reopen");
  await writeFile(join(path, "notes.md"), "Keep these notes.");
  const project = await open(first, path);
  await removeProject(first, project.id);
  expect(existsSync(configPath(path))).toBe(false);
  expect(await readFile(join(path, "notes.md"), "utf8")).toBe("Keep these notes.");
  const reopened = await open(first, path);
  expect(reopened.id).not.toBe(project.id);
  expect((await first.deps.workspaceService.getDefault(reopened.id))?.setup_error).toBeNull();
});

test("legacy bindings for the same project gain workspace identity without losing fields", async () => {
  const path = await folder("legacy");
  const project = await open(first, path);
  const workspace = await first.deps.workspaceService.getDefault(project.id);
  await writeFile(configPath(path), JSON.stringify({ project_id: project.id, extra: "keep" }));
  await first.deps.workspaceService.setSetupError(workspace!.id, "Retry setup");
  await open(first, path);
  expect(JSON.parse(await readConfig(path))).toEqual({
    project_id: project.id,
    workspace_id: workspace!.id,
    extra: "keep",
  });
});

test("obsolete linked-folder configs can be replaced without taking a live workspace's folder", async () => {
  const home = await folder("migration-home");
  const project = await open(first, home);
  const discarded = await folder("discarded-link");
  await mkdir(join(discarded, ".pstdio"));
  await writeFile(configPath(discarded), JSON.stringify({ project_id: project.id }));
  const selected = await open(first, discarded);
  expect(selected.id).not.toBe(project.id);
  expect((await first.deps.workspaceService.getDefault(selected.id))?.setup_error).toBeNull();
  expect(JSON.parse(await readConfig(discarded)).project_id).toBe(selected.id);

  const working = await folder("live-workspace");
  const workspace = await first.deps.workspaceService.createStandalone({ project_id: project.id, root_path: working });
  await mkdir(join(working, ".pstdio"));
  await writeFile(configPath(working), JSON.stringify({ project_id: project.id, workspace_id: workspace.id }));
  const original = await readConfig(working);
  const rejected = await open(first, working);
  expect((await first.deps.workspaceService.getDefault(rejected.id))?.setup_error).toBeTruthy();
  expect(await readConfig(working)).toBe(original);
  await first.deps.workspaceService.archive(workspace.id);
  await open(first, working);
  expect((await first.deps.workspaceService.getDefault(rejected.id))?.setup_error).toBeTruthy();
  expect(await readConfig(working)).toBe(original);
});
