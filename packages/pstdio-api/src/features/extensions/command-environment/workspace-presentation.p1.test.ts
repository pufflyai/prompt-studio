import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultLocalWorkspaceCapabilities } from "pstdio-db";
import { git } from "pstdio-wt";
import { createTestApp } from "../../../test-utils/create-test-app";
import { runWorkspaceProvisioning } from "../../workspaces/provision-coordinator";
import { setupWorkspaceWorktree } from "../../workspaces/worktree-setup";
import { createWorkspacesApi } from "./workspaces";

let handle: Awaited<ReturnType<typeof createTestApp>>;
let root: string;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "workspace-presentation-"));
  handle = await createTestApp();
});
afterAll(async () => {
  await handle?.close();
  await rm(root, { recursive: true, force: true });
});

const fixture = async () => {
  const project = await handle.deps.projectService.create({ name: "Workspace presentation" });
  const path = join(root, project.id);
  await mkdir(path);
  const workspace = await handle.deps.workspaceService.create({
    project_id: project.id,
    shorthand_base: "WORK",
    root_path: path,
    provider_id: "pstdio.worktree",
    provider_state: "ready",
  });
  const api = (signal?: AbortSignal) =>
    createWorkspacesApi(
      handle.deps,
      { projectId: project.id, signal },
      { setupWorkspaceWorktree, runWorkspaceProvisioning },
    );
  return { project, workspace, path, api };
};

test("extensions rename workspace display names without changing their identity", async () => {
  const { workspace, api } = await fixture();
  expect(await api().rename(workspace.id, { name: " Renamed workspace " })).toMatchObject({
    id: workspace.id,
    name: "Renamed workspace",
    shorthand: workspace.workspace_shorthand,
    rootPath: workspace.root_path,
  });
  await expect(api().rename(workspace.id, { name: " " })).rejects.toThrow();
  const home = await handle.deps.workspaceService.ensureDefault({
    project_id: workspace.project_id,
    name: "Project folder",
  });
  await expect(api().rename(home.id, { name: "Other" })).rejects.toThrow("Default workspace");
});

test("extensions browse, find, edit, move and delete workspace files through the host", async () => {
  const { workspace, path, api } = await fixture();
  const files = api();
  await files.createDirectory(workspace.id, "docs");
  expect(await files.createFile(workspace.id, "docs/notes.md", { content: "original\n" })).toMatchObject({
    path: "docs/notes.md",
    encoding: "utf8",
    editable: true,
    content: "original\n",
  });
  await expect(files.createFile(workspace.id, "docs/notes.md", { content: "replace" })).rejects.toThrow(
    "already exists",
  );
  expect((await files.listFiles(workspace.id)).entries.map((entry) => entry.path)).toEqual(["docs"]);
  expect(
    (await files.listFiles(workspace.id, { query: "notes", limit: 1 })).entries.map((entry) => entry.path),
  ).toEqual(["docs/notes.md"]);
  await files.writeFile(workspace.id, "docs/notes.md", { content: "saved\n" });
  await files.moveEntry(workspace.id, "docs", "renamed");
  expect(await files.readFile(workspace.id, "renamed/notes.md")).toMatchObject({ content: "saved\n" });
  expect(await readFile(join(path, "renamed/notes.md"), "utf8")).toBe("saved\n");
  await files.deleteEntry(workspace.id, "renamed");
  expect((await files.listFiles(workspace.id)).entries).toEqual([]);
  await expect(files.writeFile(workspace.id, "missing.md", { content: "save" })).rejects.toThrow();
});

test("extensions read lightweight changes and lazy file bodies in both comparison modes", async () => {
  const { workspace, path, api } = await fixture();
  await git(path, ["init", "-b", "main"]);
  await git(path, ["config", "user.email", "test@example.com"]);
  await git(path, ["config", "user.name", "Test"]);
  await writeFile(join(path, "notes.txt"), "before\n");
  await git(path, ["add", "."]);
  await git(path, ["commit", "-m", "initial"]);
  await git(path, ["switch", "-c", "workspace/presentation"]);
  await writeFile(join(path, "notes.txt"), "committed\n");
  await git(path, ["add", "."]);
  await git(path, ["commit", "-m", "change"]);
  await writeFile(join(path, "notes.txt"), "working\n");
  await mkdir(join(path, "subfolder"));
  await handle.deps.workspaceService.updateProviderProjection(workspace.id, {
    root_path: join(path, "subfolder"),
    provider_ref_json: { version: 1, data: { sourceRoot: path, worktreeRoot: path } },
  });
  const changes = api();
  const summary = await changes.diffFiles(workspace.id, "fork_point");
  expect(summary?.files).toContainEqual(expect.objectContaining({ filePath: "notes.txt", additions: 1, deletions: 1 }));
  expect(summary?.files[0]).not.toHaveProperty("oldContent");
  expect(await changes.diffFile(workspace.id, "fork_point", "notes.txt")).toMatchObject({
    oldContent: "before\n",
    newContent: "working\n",
  });
  expect(await changes.diffFile(workspace.id, "current", "notes.txt")).toMatchObject({
    oldContent: "committed\n",
    newContent: "working\n",
  });
  expect(await changes.diffSummary(workspace.id, "current")).toMatchObject({
    workspace_id: workspace.id,
    file_count: 1,
    additions: 1,
    deletions: 1,
  });
  expect(await changes.diffFile(workspace.id, "current", "missing.txt")).toBeNull();
});

test("scoped workspace operations reject other projects and cancelled invocations", async () => {
  const first = await fixture();
  const other = await fixture();
  const operations = (api: ReturnType<typeof first.api>, id: string) => [
    () => api.rename(id, { name: "Changed" }),
    () => api.listFiles(id),
    () => api.readFile(id, "notes.txt"),
    () => api.createFile(id, "notes.txt", { content: "changed" }),
    () => api.createDirectory(id, "docs"),
    () => api.writeFile(id, "notes.txt", { content: "changed" }),
    () => api.moveEntry(id, "notes.txt", "other.txt"),
    () => api.deleteEntry(id, "notes.txt"),
    () => api.diffFiles(id, "current"),
    () => api.diffFile(id, "current", "notes.txt"),
    () => api.diffSummary(id, "current"),
  ];
  for (const operation of operations(first.api(), other.workspace.id))
    await expect(operation()).rejects.toThrow("Workspace not found");
  const controller = new AbortController();
  controller.abort();
  for (const operation of operations(first.api(controller.signal), first.workspace.id))
    await expect(operation()).rejects.toThrow();
  expect((await handle.deps.workspaceService.get(first.workspace.id))?.name).toBe(first.workspace.name);
});

test("workspace file operations enforce live provider capabilities and safe paths", async () => {
  const { workspace, path, api } = await fixture();
  await writeFile(join(path, "notes.txt"), "keep");
  const files = api();
  await handle.deps.workspaceService.updateProviderProjection(workspace.id, {
    provider_capabilities_json: { ...defaultLocalWorkspaceCapabilities, files: "read", diff: false },
  });
  expect(await files.readFile(workspace.id, "notes.txt")).toMatchObject({ content: "keep", editable: false });
  await expect(files.writeFile(workspace.id, "notes.txt", { content: "changed" })).rejects.toThrow();
  await expect(files.createDirectory(workspace.id, "docs")).rejects.toThrow();
  await expect(files.createFile(workspace.id, "new.txt", { content: "changed" })).rejects.toThrow();
  await expect(files.moveEntry(workspace.id, "notes.txt", "other.txt")).rejects.toThrow();
  await expect(files.deleteEntry(workspace.id, "notes.txt")).rejects.toThrow();
  await expect(files.diffFiles(workspace.id, "current")).rejects.toThrow();
  await handle.deps.workspaceService.updateProviderProjection(workspace.id, {
    provider_capabilities_json: defaultLocalWorkspaceCapabilities,
  });
  await mkdir(join(path, ".git/hooks"), { recursive: true });
  await writeFile(join(path, ".git/config"), "protected");
  await symlink(join(path, ".git"), join(path, "metadata-alias"), "dir");
  await expect(files.listFiles(workspace.id, { path: ".git" })).rejects.toThrow("Git metadata");
  await expect(files.readFile(workspace.id, "metadata-alias/config")).rejects.toThrow("Git metadata");
  await expect(files.createFile(workspace.id, "metadata-alias/hooks/new-hook", { content: "changed" })).rejects.toThrow(
    "Git metadata",
  );
  await symlink(root, join(path, "outside"), "dir");
  for (const entry of ["../secret.txt", "outside/secret.txt", ".git/config"]) {
    await expect(files.readFile(workspace.id, entry)).rejects.toThrow();
    await expect(files.createFile(workspace.id, entry, { content: "escape" })).rejects.toThrow();
    await expect(files.moveEntry(workspace.id, "notes.txt", entry)).rejects.toThrow();
  }
  await handle.deps.workspaceService.updateProviderProjection(workspace.id, { execution_kind: "remote" });
  await expect(files.listFiles(workspace.id)).rejects.toThrow();
  await expect(files.diffSummary(workspace.id, "current")).rejects.toThrow();
  expect(await readFile(join(path, "notes.txt"), "utf8")).toBe("keep");
});

test("workspace operations recheck readiness, deletion and disabled file access", async () => {
  const { workspace, api } = await fixture();
  const scoped = api();
  await handle.deps.workspaceService.updateProviderProjection(workspace.id, { provider_state: "failed" });
  await expect(scoped.listFiles(workspace.id)).rejects.toThrow("ready local");
  await expect(scoped.diffFiles(workspace.id, "current")).rejects.toThrow("ready local");
  await handle.deps.workspaceService.updateProviderProjection(workspace.id, { provider_state: "ready" });
  await handle.deps.workspaceService.setInitializing(workspace.id, true);
  await expect(scoped.listFiles(workspace.id)).rejects.toThrow("ready local");
  await handle.deps.workspaceService.setInitializing(workspace.id, false);
  await handle.deps.workspaceService.updateProviderProjection(workspace.id, {
    provider_capabilities_json: { ...defaultLocalWorkspaceCapabilities, files: "none" },
  });
  await expect(scoped.listFiles(workspace.id)).rejects.toThrow("ready local");
  await handle.deps.workspaceService.softDelete(workspace.id);
  await expect(scoped.rename(workspace.id, { name: "Revived" })).rejects.toThrow("Workspace not found");
  await expect(scoped.diffSummary(workspace.id, "current")).rejects.toThrow("Workspace not found");
});

test("workspace changes reject a missing or non-Git execution root", async () => {
  const { workspace, path, api } = await fixture();
  const scoped = api();
  const assertUnavailable = async () => {
    await expect(scoped.diffFiles(workspace.id, "current")).rejects.toThrow();
    await expect(scoped.diffSummary(workspace.id, "fork_point")).rejects.toThrow();
    await expect(scoped.diffFile(workspace.id, "current", "notes.txt")).rejects.toThrow();
  };
  await assertUnavailable();
  await rm(path, { recursive: true });
  await assertUnavailable();
});
