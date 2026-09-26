import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultLocalWorkspaceCapabilities } from "pstdio-db";
import { git } from "pstdio-wt";
import { createWorkspacesApi } from "../extensions/command-environment/workspaces";
import type { ExtensionsRouteDeps } from "../extensions/deps";
import { makeWorkspace } from "./workspace-provider.test-fixture";

type Workspace = NonNullable<Awaited<ReturnType<ExtensionsRouteDeps["workspaceService"]["get"]>>>;

const originalHome = process.env.PSTDIO_HOME;
let root: string;
let source: string;
let managedPath: string;
let workspace: Workspace;
let folders: Array<{ id: string; path: string }>;

const createRepo = async (path: string) => {
  await mkdir(path, { recursive: true });
  await git(path, ["init"]);
  await git(path, [
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.com",
    "commit",
    "--allow-empty",
    "-m",
    "base",
  ]);
};

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), "legacy-worktree-provider-")));
  process.env.PSTDIO_HOME = join(root, "home");
  source = join(root, "source");
  managedPath = join(process.env.PSTDIO_HOME, "workspaces", "WS-1");
  await createRepo(source);
  await git(source, ["worktree", "add", "-b", "workspace/WS-1", managedPath]);
  workspace = {
    ...makeWorkspace(),
    provider_id: "pstdio.root",
    provider_ref_json: null,
    execution_kind: "local",
    worktree_path: managedPath,
    branch: "workspace/WS-1",
    provider_capabilities_json: defaultLocalWorkspaceCapabilities,
  };
  folders = [{ id: "source", path: source }];
});

afterEach(async () => {
  if (originalHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = originalHome;
  await rm(root, { recursive: true, force: true });
});

const api = (removed?: Workspace[]) =>
  createWorkspacesApi(
    {
      workspaceService: {
        get: async () => workspace,
        getDefault: async () => workspace,
        getByShorthand: async () => workspace,
        list: async () => [workspace],
        softDelete: async () => {},
      },
      repoService: { listByProject: async () => folders },
    } as never,
    { projectId: workspace.project_id },
    {
      deleteProviderBackedWorkspace: async (_deps: unknown, record: Workspace) => {
        removed?.push(record);
        return false;
      },
    } as never,
  );

test("legacy managed Git worktrees expose their actual provider and source without changing stored rows", async () => {
  workspace.workspace_shorthand = "PS_WS-7";
  const unrelated = join(root, "unrelated");
  await createRepo(unrelated);
  folders.unshift({ id: "unrelated", path: unrelated });
  const workspaces = api();
  const providerRef = { version: 1, data: { sourceRoot: source, worktreeRoot: managedPath, relativePath: "" } };
  const expected = {
    id: workspace.id,
    provider_id: "pstdio.worktree",
    root_path: managedPath,
    provider_ref_json: providerRef,
  };

  expect(await workspaces.get(workspace.id)).toMatchObject(expected);
  expect(await workspaces.list()).toEqual([expect.objectContaining(expected)]);
  expect(await workspaces.getByShorthand(workspace.workspace_shorthand)).toMatchObject(expected);
  expect(await workspaces.resolve(workspace.id)).toMatchObject({
    providerRef,
    executionTarget: { kind: "local", rootPath: managedPath },
  });
  expect(workspace.provider_id).toBe("pstdio.root");
  expect(workspace.provider_ref_json).toBeNull();
});

test("ordinary managed folders and unrelated repositories are not identified as Git worktrees", async () => {
  const ordinaryPath = join(process.env.PSTDIO_HOME!, "workspaces", "WS-2");
  await mkdir(ordinaryPath);
  Object.assign(workspace, { worktree_path: ordinaryPath, workspace_shorthand: "WS-2", branch: "workspace/WS-2" });
  expect(await api().get(workspace.id)).toMatchObject({ provider_id: "pstdio.root", provider_ref_json: null });
  await createRepo(ordinaryPath);
  expect(await api().get(workspace.id)).toMatchObject({ provider_id: "pstdio.root", provider_ref_json: null });
});

test("a linked user folder keeps its provider even when it is a managed Git worktree", async () => {
  const selectedAlias = join(root, "selected-alias");
  await symlink(managedPath, selectedAlias, "junction");
  folders.push({ id: "selected", path: selectedAlias });
  expect(await api().get(workspace.id)).toMatchObject({ provider_id: "pstdio.root", provider_ref_json: null });
});

test("a recorded alias of a managed worktree resolves to its canonical provider reference", async () => {
  const alias = join(root, "worktree-alias");
  await symlink(managedPath, alias, "junction");
  workspace.worktree_path = alias;
  expect(await api().get(workspace.id)).toMatchObject({
    provider_id: "pstdio.worktree",
    root_path: alias,
    provider_ref_json: { version: 1, data: { sourceRoot: source, worktreeRoot: managedPath, relativePath: "" } },
  });
});

test("a managed folder inside a linked repository is not a Git worktree", async () => {
  process.env.PSTDIO_HOME = join(source, "home");
  const ordinaryPath = join(process.env.PSTDIO_HOME, "workspaces", "WS-2");
  await mkdir(ordinaryPath, { recursive: true });
  await git(source, ["branch", "workspace/WS-2"]);
  Object.assign(workspace, { worktree_path: ordinaryPath, workspace_shorthand: "WS-2", branch: "workspace/WS-2" });
  expect(await api().get(workspace.id)).toMatchObject({ provider_id: "pstdio.root", provider_ref_json: null });
});

test("worktrees outside the managed path and branches without the legacy shorthand keep their provider", async () => {
  workspace.branch = "user-branch";
  expect(await api().get(workspace.id)).toMatchObject({ provider_id: "pstdio.root", provider_ref_json: null });
  const externalPath = join(root, "user-worktree");
  await git(source, ["worktree", "move", managedPath, externalPath]);
  Object.assign(workspace, { branch: "workspace/WS-1", worktree_path: externalPath });
  expect(await api().get(workspace.id)).toMatchObject({ provider_id: "pstdio.root", provider_ref_json: null });
});

test("default, explicit Git and remote workspace identities remain unchanged", async () => {
  workspace.is_default = true;
  expect(await api().getDefault()).toMatchObject({ provider_id: "pstdio.root", provider_ref_json: null });
  Object.assign(workspace, { is_default: false, execution_kind: "remote" });
  expect(await api().get(workspace.id)).toMatchObject({
    provider_id: "pstdio.root",
    root_path: null,
    provider_ref_json: null,
  });
  Object.assign(workspace, {
    is_default: false,
    execution_kind: "local",
    provider_id: "pstdio.worktree",
    provider_ref_json: { version: 1, data: { existing: true } },
  });
  expect(await api().get(workspace.id)).toMatchObject({
    provider_id: "pstdio.worktree",
    provider_ref_json: workspace.provider_ref_json,
  });
  Object.assign(workspace, { execution_kind: "remote", provider_id: "example.cloud" });
  expect(await api().get(workspace.id)).toMatchObject({
    provider_id: "example.cloud",
    root_path: null,
    provider_ref_json: workspace.provider_ref_json,
  });
});

test("legacy lifecycle deletion receives the stored workspace after its provider is projected", async () => {
  const removed: Workspace[] = [];
  const workspaces = api(removed);
  expect(await workspaces.get(workspace.id)).toMatchObject({ provider_id: "pstdio.worktree" });
  await workspaces.delete(workspace.id);
  expect(removed).toEqual([workspace]);
  expect(removed[0].provider_id).toBe("pstdio.root");
});
