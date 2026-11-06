import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSyncSpace } from "pstdio-sync/encryption";
import { captureRecoveryFolder } from "./capture";
import { createRecoveryChunkStore } from "./chunks";
import { readRecoveryManifest } from "./manifest";
import { createRecoveryPages } from "./pages";
import { prepareRecoveryCapture } from "./transfer";
import { verifyRecoveryCapture } from "./verify-capture";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
const git = (cwd: string, ...args: string[]) => {
  const result = Bun.spawnSync(["git", "-c", "init.defaultBranch=main", ...args], {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@t",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@t",
    },
  });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
};
const fixture = async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "recovery-git-")));
  roots.push(root);
  const repository = join(root, "repository");
  await mkdir(repository);
  git(repository, "init", "-q");
  await writeFile(join(repository, "tracked"), "committed bytes");
  git(repository, "add", "tracked");
  git(repository, "commit", "-qm", "initial");
  const space = await createSyncSpace({
    projectId: "project",
    spaceOwner: "owner",
    keys: [{ generation: 1, secret: "A".repeat(43) }],
  });
  const chunks = await createRecoveryChunkStore({ root: join(root, "recovery"), space });
  return { root, repository, chunks, pages: createRecoveryPages(chunks) };
};
const paths = async (pages: ReturnType<typeof createRecoveryPages>, inventory: Parameters<typeof pages.entries>[0]) => {
  const result: string[] = [];
  for await (const entry of pages.entries(inventory)) result.push(entry.path);
  return result;
};

test("a linked worktree captures its registered administration and common object store without other worktrees", async () => {
  const { root, repository, chunks, pages } = await fixture();
  const worktree = join(root, "worktree");
  git(repository, "worktree", "add", "-q", worktree);
  git(repository, "worktree", "add", "-q", join(root, "unrelated-worktree"));
  await writeFile(join(worktree, "unpushed"), "local work");
  git(worktree, "add", "unpushed");
  git(worktree, "commit", "-qm", "local only");
  const captured = await captureRecoveryFolder({ root: worktree, chunks, gitRoots: [repository] });
  expect(captured.git.state).toBe("functional");
  expect(captured.git.problems).toEqual([]);
  const admin = captured.git.dependencies.find((dependency) => dependency.kind === "git-admin")!;
  const common = captured.git.dependencies.find((dependency) => dependency.kind === "git-common")!;
  expect(admin.path).toBe(join(repository, ".git/worktrees/worktree"));
  expect(common.path).toBe(join(repository, ".git"));
  expect(await paths(pages, admin.inventory)).toEqual(expect.arrayContaining(["HEAD", "gitdir", "commondir", "index"]));
  const commonPaths = await paths(pages, common.inventory);
  expect(commonPaths).toEqual(expect.arrayContaining(["HEAD", "config", "objects"]));
  expect(commonPaths.some((path) => path.startsWith("worktrees/"))).toBe(false);
  const candidate = await prepareRecoveryCapture({
    chunks,
    source: { id: "workspace", deviceId: "device", name: "Laptop", folder: worktree },
    capture: captured,
  });
  await verifyRecoveryCapture(chunks, await readRecoveryManifest(chunks, candidate));
});

test("unregistered, unrelated and excluded Git administration never becomes functional Git recovery", async () => {
  const { root, repository, chunks, pages } = await fixture();
  const worktree = join(root, "worktree");
  git(repository, "worktree", "add", "-q", worktree);
  const unregistered = await captureRecoveryFolder({ root: worktree, chunks, gitRoots: [] });
  expect(unregistered.git).toMatchObject({ state: "incomplete", dependencies: [] });
  expect(unregistered.git.problems).toEqual([{ path: ".git", reason: "unregistered" }]);
  expect(await paths(pages, unregistered.inventory)).toContain(".git");

  const crafted = join(root, "crafted");
  await mkdir(join(crafted, "nested/.git/objects/info"), { recursive: true });
  await mkdir(join(root, "private/objects"), { recursive: true });
  await writeFile(join(root, "private/objects/secret"), "UNRELATED_PRIVATE_BYTES");
  await writeFile(join(crafted, ".git"), `gitdir: ${join(repository, ".git/worktrees/worktree")}\n`);
  await writeFile(join(crafted, "nested/.git/objects/info/alternates"), `${join(root, "private/objects")}\n`);
  const refused = await captureRecoveryFolder({ root: crafted, chunks, gitRoots: [repository] });
  expect(refused.git.state).toBe("incomplete");
  expect(refused.git.dependencies).toEqual([]);
  expect(refused.git.problems).toEqual(
    expect.arrayContaining([
      { path: ".git", reason: "relationship" },
      { path: "nested/.git/objects/info/alternates", reason: "unregistered" },
    ]),
  );

  await writeFile(join(repository, ".pstignore"), ".git/objects/\n");
  const excluded = await captureRecoveryFolder({ root: repository, chunks, gitRoots: [repository] });
  expect(excluded.git.state).toBe("incomplete");
  expect(excluded.git.problems).toEqual([{ path: ".git/objects", reason: "excluded" }]);
  const plain = join(root, "plain");
  await mkdir(plain);
  expect((await captureRecoveryFolder({ root: plain, chunks })).git).toEqual({
    state: "none",
    dependencies: [],
    problems: [],
  });
});
