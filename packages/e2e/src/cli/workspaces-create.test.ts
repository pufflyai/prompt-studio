import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs, createGitRepo, runPstdio } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;

beforeAll(async () => {
  api = await startApi();
}, SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

const dirs: string[] = [];

afterEach(() => {
  cleanupDirs(dirs);
});

const run = (args: string, cwd: string) => runPstdio(args, cwd, { PSTDIO_API_URL: api.url });

const createInitializedRepo = (name: string) => {
  const repo = createGitRepo();
  dirs.push(repo);
  execSync("git commit --allow-empty -m init", { cwd: repo, stdio: "pipe" });
  run(`projects create ${name}`, repo);
  return repo;
};

const readProjectId = (repo: string) => {
  const configPath = join(repo, ".pstdio", "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8")) as { project_id: string };
  return config.project_id;
};

describe("pstdio workspaces create", () => {
  test(
    "creates and deletes a worktree-backed workspace without a ticket",
    async () => {
      const repo = createInitializedRepo("workspace-create-ticketless");
      const projectId = readProjectId(repo);

      const createOutput = run("workspaces create", repo);
      expect(createOutput).toContain("Created workspace WS-1");

      const worktreePath = createOutput.match(/Created workspace WS-1 at (\S+)/)?.[1];
      expect(worktreePath).toBeTruthy();
      expect(existsSync(worktreePath!)).toBe(true);

      const byShorthandUrl = `${api.url}/v1/workspaces/by-shorthand?project_id=${encodeURIComponent(projectId)}&shorthand=WS-1`;
      const createdRes = await fetch(byShorthandUrl);
      expect(createdRes.status).toBe(200);
      const created = (await createdRes.json()) as { branch: string | null; worktree_path: string | null };
      expect(created.branch).toBe("workspace/WS-1");
      expect(created.worktree_path).toBe(worktreePath);

      const deleteOutput = run("workspaces delete --id WS-1", repo);
      expect(deleteOutput).toContain("Deleted workspace WS-1");

      const afterDeleteRes = await fetch(byShorthandUrl);
      expect(afterDeleteRes.status).toBe(404);
      expect(existsSync(worktreePath!)).toBe(false);
    },
    TEST_TIMEOUT,
  );
});
