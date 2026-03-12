import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { listBranches } from "./branches";
import { git } from "./git";
import { createTempRepo } from "./test-helpers";

let repo: Awaited<ReturnType<typeof createTempRepo>>;

beforeEach(async () => {
  repo = await createTempRepo();
});

afterEach(async () => {
  await repo.cleanup();
});

describe("listBranches", () => {
  test("returns the current branch marked as current", async () => {
    const branches = await listBranches(repo.dir);

    expect(branches.length).toBe(1);
    expect(branches[0].name).toBe("main");
    expect(branches[0].isCurrent).toBe(true);
    expect(branches[0].isRemote).toBe(false);
    expect(branches[0].lastCommitDate).toBeTruthy();
  });

  test("returns multiple branches with correct current marker", async () => {
    await git(repo.dir, ["branch", "feature-a"]);
    await git(repo.dir, ["branch", "feature-b"]);

    const branches = await listBranches(repo.dir);
    const names = branches.map((b) => b.name).sort();

    expect(names).toEqual(["feature-a", "feature-b", "main"]);

    const current = branches.filter((b) => b.isCurrent);
    expect(current.length).toBe(1);
    expect(current[0].name).toBe("main");
  });

  test("marks remote branches as remote", async () => {
    // Simulate a remote by adding a remote ref
    await git(repo.dir, ["remote", "add", "origin", repo.dir]);
    await git(repo.dir, ["fetch", "origin"]);

    const branches = await listBranches(repo.dir);
    const remote = branches.filter((b) => b.isRemote);

    expect(remote.length).toBeGreaterThan(0);
    expect(remote[0].name).toContain("origin/");
  });
});
