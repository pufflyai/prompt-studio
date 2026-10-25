import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { git } from "./git";
import { resolveLatestBase } from "./resolve-base";
import { createTempRepo } from "./test-helpers";
import { createWorktree } from "./worktree";

const makeBareRemote = async () => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "pstdio-wt-remote-")));
  await git(dir, ["init", "--bare", "-b", "main"]);
  return dir;
};

const advanceRemoteMain = async (remoteDir: string) => {
  const clone = await realpath(await mkdtemp(join(tmpdir(), "pstdio-wt-clone-")));
  await git(clone, ["clone", remoteDir, "."]);
  await git(clone, ["config", "user.email", "c@c.c"]);
  await git(clone, ["config", "user.name", "c"]);
  await Bun.write(join(clone, "advance.txt"), "new");
  await git(clone, ["add", "."]);
  await git(clone, ["commit", "-m", "advance remote"]);
  await git(clone, ["push", "origin", "main"]);
  const sha = await git(clone, ["rev-parse", "HEAD"]);
  await rm(clone, { recursive: true, force: true });
  return sha;
};

let localRepo: Awaited<ReturnType<typeof createTempRepo>>;
let remoteDir: string;

beforeEach(async () => {
  remoteDir = await makeBareRemote();
  localRepo = await createTempRepo();
  await git(localRepo.dir, ["remote", "add", "origin", remoteDir]);
  await git(localRepo.dir, ["push", "-u", "origin", "main"]);
});

afterEach(async () => {
  await localRepo.cleanup();
  await rm(remoteDir, { recursive: true, force: true });
});

describe("resolveLatestBase", () => {
  test("prefers the tracked upstream when local is behind", async () => {
    const advancedSha = await advanceRemoteMain(remoteDir);

    const base = await resolveLatestBase(localRepo.dir, "main");

    expect(base).toBe("origin/main");

    const wt = join(localRepo.dir, "wt-fresh");
    await createWorktree({ repoRoot: localRepo.dir, branch: "task/fresh", path: wt, base });
    const wtHead = await git(wt, ["rev-parse", "HEAD"]);
    expect(wtHead).toBe(advancedSha);
  });

  test("keeps local branch when local is ahead of upstream", async () => {
    await Bun.write(join(localRepo.dir, "local.txt"), "only");
    await git(localRepo.dir, ["add", "."]);
    await git(localRepo.dir, ["commit", "-m", "local only"]);
    const localSha = await git(localRepo.dir, ["rev-parse", "main"]);

    const base = await resolveLatestBase(localRepo.dir, "main");

    expect(base).toBe("main");

    const wt = join(localRepo.dir, "wt-local");
    await createWorktree({ repoRoot: localRepo.dir, branch: "task/local", path: wt, base });
    const wtHead = await git(wt, ["rev-parse", "HEAD"]);
    expect(wtHead).toBe(localSha);
  });

  test("returns local branch for a branch without an upstream", async () => {
    await git(localRepo.dir, ["branch", "local-only"]);

    const base = await resolveLatestBase(localRepo.dir, "local-only");

    expect(base).toBe("local-only");
  });

  test("works on a repo with no remotes configured", async () => {
    const standalone = await createTempRepo();
    try {
      const base = await resolveLatestBase(standalone.dir, "main");
      expect(base).toBe("main");
    } finally {
      await standalone.cleanup();
    }
  });

  test("follows upstream even when the remote is not named origin", async () => {
    const secondRemote = await makeBareRemote();
    const anotherLocal = await createTempRepo();
    try {
      await git(anotherLocal.dir, ["remote", "add", "fork", secondRemote]);
      await git(anotherLocal.dir, ["push", "-u", "fork", "main"]);

      const clone = await realpath(await mkdtemp(join(tmpdir(), "pstdio-wt-fork-clone-")));
      await git(clone, ["clone", secondRemote, "."]);
      await git(clone, ["config", "user.email", "c@c.c"]);
      await git(clone, ["config", "user.name", "c"]);
      await Bun.write(join(clone, "fork-advance.txt"), "new");
      await git(clone, ["add", "."]);
      await git(clone, ["commit", "-m", "fork advance"]);
      await git(clone, ["push", "origin", "main"]);
      await rm(clone, { recursive: true, force: true });

      const base = await resolveLatestBase(anotherLocal.dir, "main");
      expect(base).toBe("fork/main");
    } finally {
      await anotherLocal.cleanup();
      await rm(secondRemote, { recursive: true, force: true });
    }
  });

  test("passes HEAD through unchanged", async () => {
    expect(await resolveLatestBase(localRepo.dir, "HEAD")).toBe("HEAD");
  });

  test("passes remote-tracking ref through unchanged", async () => {
    await advanceRemoteMain(remoteDir);

    const base = await resolveLatestBase(localRepo.dir, "origin/main");

    expect(base).toBe("origin/main");
  });
});
