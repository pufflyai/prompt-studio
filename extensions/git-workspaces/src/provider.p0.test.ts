import { afterEach, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import type { ExtensionWorkspace, WorkspaceProviderRef } from "@pstdio/sdk/extensions";
import { gitFixture } from "./git.test-fixture";
import { gitWorkspace } from "./provider";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const fixture = async (managedName = "git-managed-workspace-") => {
  const repo = await gitFixture();
  const target = realpathSync(mkdtempSync(join(tmpdir(), managedName)));
  roots.push(repo.root, target);
  const workspace: ExtensionWorkspace = { id: crypto.randomUUID(), shorthand: "WS-1", providerState: "provisioning" };
  const ctx = repo.context();
  ctx.workspaces.get = async () => workspace;
  ctx.localDirectory = async () => {
    mkdirSync(target, { recursive: true });
    return {
      path: target,
      files: {
        ...ctx.artifacts.mount("owned"),
        exists: async (path) => {
          if (!existsSync(join(target, path))) return false;
          const contained = relative(realpathSync(target), realpathSync(join(target, path)));
          if (contained === ".." || contained.startsWith("../") || isAbsolute(contained))
            throw new Error("Artifact path escapes mount root");
          return true;
        },
        listDirs: async (path = "") =>
          readdirSync(join(target, path), { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => join(path, entry.name)),
      },
      remove: async () => rmSync(target, { recursive: true, force: true }),
    };
  };
  const input = {
    operationId: crypto.randomUUID(),
    projectId: ctx.projectId,
    workspaceId: workspace.id,
    params: { base: "HEAD" },
  };
  return { ...repo, target, workspace, ctx, input };
};
test("Git creation persists a cleanup reference before checkout and resolves an owned worktree", async () => {
  const f = await fixture();
  const prepared = await gitWorkspace.create(f.ctx, f.input);
  expect(prepared.state).toBe("provisioning");
  expect(await f.git("worktree", "list", "--porcelain")).not.toContain(f.target);
  const ready = await gitWorkspace.resolve(f.ctx, { ...f.input, providerRef: prepared.providerRef! });
  expect(ready).toMatchObject({
    state: "ready",
    executionKind: "local",
    executionTarget: { rootPath: f.target },
    capabilities: { diff: true },
  });
  expect(await f.git("worktree", "list", "--porcelain")).toContain(f.target);
  expect(ready.branch).toBe(`workspace/WS-1-${f.workspace.id}`);
  expect(existsSync(join(f.target, "README.md"))).toBe(true);
  await gitWorkspace.delete!(f.ctx, { ...f.input, providerRef: ready.providerRef! });
  expect(existsSync(f.target)).toBe(false);
  expect(await f.git("worktree", "list", "--porcelain")).not.toContain(f.target);
  expect(await f.git("branch", "--list", ready.branch!)).toBe("");
  expect(existsSync(join(f.root, "README.md"))).toBe(true);
});
test("cancelling an accepted creation removes only its managed directory", async () => {
  const f = await fixture();
  const prepared = await gitWorkspace.create(f.ctx, f.input);
  const cancelled = await gitWorkspace.cancel!(f.ctx, { ...f.input, providerRef: prepared.providerRef! });
  expect(cancelled.state).toBe("cancelled");
  expect(existsSync(f.target)).toBe(false);
  expect(existsSync(join(f.root, "README.md"))).toBe(true);
});
test("cleanup refuses a backing reference outside the provider-owned directory", async () => {
  const f = await fixture();
  const ref: WorkspaceProviderRef = {
    version: 1,
    data: { sourceRoot: f.root, worktreeRoot: f.root, relativePath: "" },
  };
  await expect(gitWorkspace.delete!(f.ctx, { ...f.input, providerRef: ref })).rejects.toThrow("owned directory");
  expect(existsSync(join(f.root, "README.md"))).toBe(true);
});
test("branch choices accept a commit through the same public select parameter", async () => {
  const f = await fixture();
  expect(await gitWorkspace.discover!(f.ctx)).toMatchObject({
    params: { base: { allowCustomValues: true, options: [{ value: "main" }] } },
  });
  const commit = await f.git("rev-parse", "HEAD");
  const prepared = await gitWorkspace.create(f.ctx, { ...f.input, params: { base: commit } });
  const ready = await gitWorkspace.resolve(f.ctx, { ...f.input, providerRef: prepared.providerRef! });
  expect(ready.state).toBe("ready");
});

test("a legacy reference reopens its existing branch without recreating it", async () => {
  const f = await fixture();
  const branch = `workspace/WS-1-${f.workspace.id}`;
  await f.git("worktree", "add", "-b", branch, f.target, "HEAD");
  f.workspace.branch = branch;
  f.workspace.providerState = "ready";
  const ref: WorkspaceProviderRef = {
    version: 1,
    data: { providerId: "pstdio.worktree", sourceRoot: f.root, worktreeRoot: f.target, relativePath: "" },
  };
  const ready = await gitWorkspace.resolve(f.ctx, { ...f.input, providerRef: ref });
  expect(ready).toMatchObject({ state: "ready", branch, executionTarget: { rootPath: f.target } });
  await gitWorkspace.delete!(f.ctx, { ...f.input, providerRef: ref });
  expect(await f.git("branch", "--list", branch)).toBe("");
});

test("a missing ready worktree is reported without recreating lost files", async () => {
  const f = await fixture();
  const prepared = await gitWorkspace.create(f.ctx, f.input);
  const ready = await gitWorkspace.resolve(f.ctx, { ...f.input, providerRef: prepared.providerRef! });
  f.workspace.providerState = "ready";
  rmSync(f.target, { recursive: true });
  const result = await gitWorkspace.resolve(f.ctx, { ...f.input, providerRef: ready.providerRef! });
  expect(result).toMatchObject({ state: "failed", error: { code: "worktree_missing", retryable: true } });
  expect(existsSync(join(f.target, "README.md"))).toBe(false);
});

test("a prepared creation resumes after the provider becomes available again", async () => {
  const f = await fixture();
  const prepared = await gitWorkspace.create(f.ctx, f.input);
  f.workspace.providerState = "provider_missing";
  const ready = await gitWorkspace.resolve(f.ctx, { ...f.input, providerRef: prepared.providerRef! });
  expect(ready).toMatchObject({ state: "ready", executionTarget: { rootPath: f.target } });
  expect(ready.providerRef!.data).not.toHaveProperty("base");
});

test("cleanup recognizes the original branch format of legacy workspaces", async () => {
  const f = await fixture();
  const branch = `workspace/${f.workspace.shorthand}`;
  await f.git("worktree", "add", "-b", branch, f.target, "HEAD");
  f.workspace.branch = branch;
  const providerRef: WorkspaceProviderRef = {
    version: 1,
    data: { sourceRoot: f.root, worktreeRoot: f.target, relativePath: "" },
  };
  await gitWorkspace.delete!(f.ctx, { ...f.input, providerRef });
  expect(await f.git("branch", "--list", branch)).toBe("");
});

test("cancellation after checkout removes its files and branch", async () => {
  const f = await fixture();
  const prepared = await gitWorkspace.create(f.ctx, f.input);
  await gitWorkspace.resolve(f.ctx, { ...f.input, providerRef: prepared.providerRef! });
  expect((await gitWorkspace.cancel!(f.ctx, { ...f.input, providerRef: prepared.providerRef! })).state).toBe(
    "cancelled",
  );
  expect(existsSync(f.target)).toBe(false);
  expect(await f.git("branch", "--list", `workspace/WS-1-${f.workspace.id}`)).toBe("");
});

test("cleanup removes its owned files when the source repository has been removed", async () => {
  const f = await fixture();
  const prepared = await gitWorkspace.create(f.ctx, f.input);
  await gitWorkspace.resolve(f.ctx, { ...f.input, providerRef: prepared.providerRef! });
  rmSync(f.root, { recursive: true });
  await gitWorkspace.delete!(f.ctx, { ...f.input, providerRef: prepared.providerRef! });
  expect(existsSync(f.target)).toBe(false);
});

test("a locked worktree retains its files after cleanup fails and can be removed after unlocking", async () => {
  const f = await fixture();
  const prepared = await gitWorkspace.create(f.ctx, f.input);
  await gitWorkspace.resolve(f.ctx, { ...f.input, providerRef: prepared.providerRef! });
  await f.git("worktree", "lock", f.target);
  await expect(gitWorkspace.delete!(f.ctx, { ...f.input, providerRef: prepared.providerRef! })).rejects.toThrow();
  expect(existsSync(join(f.target, "README.md"))).toBe(true);
  await f.git("worktree", "unlock", f.target);
  await gitWorkspace.delete!(f.ctx, { ...f.input, providerRef: prepared.providerRef! });
  expect(existsSync(f.target)).toBe(false);
});

test("a nested project keeps its relative directory in the isolated checkout", async () => {
  const f = await fixture();
  const folder = join(f.root, "packages", "研究");
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "notes.txt"), "Nested project");
  await f.git("add", ".");
  await f.git("commit", "-m", "Add nested project");
  f.ctx.workspaces.getDefault = async () => ({ id: "home", rootPath: folder, executionKind: "local" });
  const prepared = await gitWorkspace.create(f.ctx, f.input);
  const ready = await gitWorkspace.resolve(f.ctx, { ...f.input, providerRef: prepared.providerRef! });
  expect(ready).toMatchObject({ executionTarget: { rootPath: join(f.target, "packages", "研究") } });
  expect(existsSync(join(f.target, "packages", "研究", "notes.txt"))).toBe(true);
});

test("a project folder absent at the chosen base is rejected before checkout", async () => {
  const f = await fixture();
  const base = await f.git("rev-parse", "HEAD");
  const folder = join(f.root, "new-package");
  mkdirSync(folder);
  writeFileSync(join(folder, "notes.txt"), "New project");
  await f.git("add", ".");
  await f.git("commit", "-m", "Add project");
  f.ctx.workspaces.getDefault = async () => ({ id: "home", rootPath: folder, executionKind: "local" });
  await expect(gitWorkspace.create(f.ctx, { ...f.input, params: { base } })).rejects.toThrow("project folder");
  expect(await f.git("worktree", "list", "--porcelain")).not.toContain(f.target);
});

test("a base whose project folder is a symlink is rejected before checkout", async () => {
  const f = await fixture();
  const link = join(f.root, "link-target.txt");
  writeFileSync(link, f.root);
  const blob = await f.git("hash-object", "-w", link);
  await f.git("update-index", "--add", "--cacheinfo", `120000,${blob},docs`);
  await f.git("commit", "-m", "Record symlink project");
  const base = await f.git("rev-parse", "HEAD");
  const folder = join(f.root, "docs");
  mkdirSync(folder);
  writeFileSync(join(folder, "notes.txt"), "Current project");
  await f.git("add", ".");
  await f.git("commit", "-m", "Replace project with directory");
  f.ctx.workspaces.getDefault = async () => ({ id: "home", rootPath: folder, executionKind: "local" });
  await expect(gitWorkspace.create(f.ctx, { ...f.input, params: { base } })).rejects.toThrow("project folder");
  expect(await f.git("worktree", "list", "--porcelain")).not.toContain(f.target);
  expect(existsSync(join(f.root, "README.md"))).toBe(true);
});

test("branch cleanup failure retains recovery until its other checkout is released", async () => {
  const f = await fixture();
  const prepared = await gitWorkspace.create(f.ctx, f.input);
  const ready = await gitWorkspace.resolve(f.ctx, { ...f.input, providerRef: prepared.providerRef! });
  await f.git("-C", f.target, "switch", "-c", "scratch");
  const external = `${f.target}-external`;
  roots.push(external);
  await f.git("worktree", "add", external, ready.branch!);
  await expect(gitWorkspace.delete!(f.ctx, { ...f.input, providerRef: ready.providerRef! })).rejects.toThrow();
  expect(existsSync(join(external, "README.md"))).toBe(true);
  await f.git("worktree", "remove", "--force", external);
  await gitWorkspace.delete!(f.ctx, { ...f.input, providerRef: ready.providerRef! });
  expect(await f.git("branch", "--list", ready.branch!)).toBe("");
});

test("a checkout hook cannot redirect a nested project outside its managed directory", async () => {
  const f = await fixture();
  const folder = join(f.root, "docs");
  mkdirSync(folder);
  writeFileSync(join(folder, "notes.txt"), "Nested project");
  await f.git("add", ".");
  await f.git("commit", "-m", "Add nested project");
  const outside = realpathSync(mkdtempSync(join(tmpdir(), "git-outside-project-")));
  roots.push(outside);
  writeFileSync(join(outside, "notes.txt"), "Outside files");
  const hook = join(f.root, ".git", "hooks", "post-checkout");
  writeFileSync(hook, `#!/bin/sh\nrm -rf docs\nln -s '${outside.replaceAll("'", "'\\''")}' docs\n`);
  chmodSync(hook, 0o755);
  f.ctx.workspaces.getDefault = async () => ({ id: "home", rootPath: folder, executionKind: "local" });
  const prepared = await gitWorkspace.create(f.ctx, f.input);
  await expect(gitWorkspace.resolve(f.ctx, { ...f.input, providerRef: prepared.providerRef! })).rejects.toThrow(
    "mount root",
  );
  await gitWorkspace.delete!(f.ctx, { ...f.input, providerRef: prepared.providerRef! });
  expect(existsSync(join(outside, "notes.txt"))).toBe(true);
});

test("reopening a checkout checks the nested project is still inside its owned directory", async () => {
  const f = await fixture();
  const folder = join(f.root, "docs");
  mkdirSync(folder);
  writeFileSync(join(folder, "notes.txt"), "Nested project");
  await f.git("add", ".");
  await f.git("commit", "-m", "Add nested project");
  f.ctx.workspaces.getDefault = async () => ({ id: "home", rootPath: folder, executionKind: "local" });
  const prepared = await gitWorkspace.create(f.ctx, f.input);
  const ready = await gitWorkspace.resolve(f.ctx, { ...f.input, providerRef: prepared.providerRef! });
  rmSync(join(f.target, "docs"), { recursive: true });
  symlinkSync(folder, join(f.target, "docs"), "dir");
  await expect(gitWorkspace.resolve(f.ctx, { ...f.input, providerRef: ready.providerRef! })).rejects.toThrow(
    "mount root",
  );
});

test("managed directories with quoted Git porcelain characters retain their checkout identity", async () => {
  const f = await fixture("git-managed-研究\t-");
  const prepared = await gitWorkspace.create(f.ctx, f.input);
  const ready = await gitWorkspace.resolve(f.ctx, { ...f.input, providerRef: prepared.providerRef! });
  expect(ready).toMatchObject({ state: "ready", executionTarget: { rootPath: f.target } });
  await gitWorkspace.delete!(f.ctx, { ...f.input, providerRef: ready.providerRef! });
  expect(existsSync(f.target)).toBe(false);
});

test("a resolver captured before cancellation cannot recreate its removed checkout", async () => {
  const f = await fixture();
  const prepared = await gitWorkspace.create(f.ctx, f.input);
  await gitWorkspace.cancel!(f.ctx, { ...f.input, providerRef: prepared.providerRef! });
  f.workspace.providerState = "cancelled";
  await gitWorkspace.resolve(f.ctx, { ...f.input, providerRef: prepared.providerRef! });
  expect(existsSync(f.target)).toBe(false);
  expect(await f.git("worktree", "list", "--porcelain")).not.toContain(f.target);
  expect(await f.git("branch", "--list", `workspace/WS-1-${f.workspace.id}`)).toBe("");
  expect(existsSync(join(f.root, "README.md"))).toBe(true);
});
