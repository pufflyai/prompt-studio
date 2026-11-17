import { afterEach, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { discoverGitWorkspace } from "./discovery";
import { gitFixture } from "./git.test-fixture";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const repository = async (commit = true) => {
  const fixture = await gitFixture(commit);
  roots.push(fixture.root);
  return fixture;
};

test("discovery offers real local and remote branches with the current branch selected", async () => {
  const repo = await repository();
  await repo.git("switch", "-c", "feature/notes");
  await repo.git("update-ref", "refs/remotes/origin/review", "HEAD");
  expect(await discoverGitWorkspace(repo.context())).toMatchObject({
    params: {
      base: {
        type: "select",
        defaultValue: "feature/notes",
        options: [{ value: "feature/notes" }, { value: "main" }, { value: "origin/review" }],
      },
    },
  });
});
test("discovery disambiguates a branch from a same-named tag", async () => {
  const repo = await repository();
  await repo.git("tag", "main");
  expect(await discoverGitWorkspace(repo.context())).toMatchObject({
    params: {
      base: {
        defaultValue: "heads/main",
        options: [{ value: "heads/main" }],
      },
    },
  });
});
test("discovery offers the exact detached checkout alongside real branches", async () => {
  const repo = await repository();
  await repo.git("checkout", "--detach", "HEAD");
  expect(await discoverGitWorkspace(repo.context())).toMatchObject({
    params: {
      base: {
        defaultValue: "HEAD",
        options: [{ value: "HEAD" }, { value: "main" }],
      },
    },
  });
});
test("discovery leaves ordinary folders and unavailable local projects usable without Git", async () => {
  const repo = await repository(false);
  expect(await discoverGitWorkspace(repo.context())).toBeNull();
  expect(await discoverGitWorkspace(repo.context(null))).toBeNull();
  expect(await discoverGitWorkspace(repo.context({ id: "remote", executionKind: "remote" }))).toBeNull();
});

test("Git choice discovery tolerates an invalid user branch sort configuration", async () => {
  const repo = await repository();
  await repo.git("config", "branch.sort", "invalid-sort-field");
  expect(await discoverGitWorkspace(repo.context())).toMatchObject({ params: { base: { defaultValue: "main" } } });
});
